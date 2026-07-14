/**
 * Inbound mail forwarding Lambda.
 *
 * Triggered by EventBridge S3 Object Created events from the SES inbound bucket.
 * Flow:
 *   1. Parse S3 key from EventBridge event.
 *   2. Read raw MIME email from S3.
 *   3. Extract the To address (recipient alias) from MIME headers.
 *   4. Apply branch plus-address stripping in dev environments.
 *   5. Resolve recipient:
 *      a. Check hardcoded group aliases (trainer@, vorstand@, info@).
 *      b. Fall back to individual proxy email lookup in DynamoDB.
 *   6. Forward raw MIME via SES — rewrite From, add Reply-To.
 *
 * Idempotency: EventBridge fires Object Created exactly once per S3 object.
 * The S3 lifecycle policy (14d prod / 3d dev) expires messages automatically.
 * Retries on Lambda throw are handled by the async invocation retry config
 * (retryAttempts: 2) and the EventBridge DLQ. No separate idempotency store
 * is needed.
 */

import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import middy from "@middy/core";
import { createDb } from "@/lib/db/electrodb-client";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { parseLambdaEnv } from "../utils/env";
import { createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { MailForwardLambdaEnvironmentSchema, S3ObjectCreatedEventSchema } from "./types";

const { logger, tracer } = createLambdaResources("mail-forward");

const env = parseLambdaEnv(MailForwardLambdaEnvironmentSchema);
const CONTENT_TABLE_NAME = env.CONTENT_TABLE_NAME;
const FORWARD_FROM_EMAIL = env.FORWARD_FROM_EMAIL;
const RECIPIENT_DOMAIN = env.RECIPIENT_DOMAIN;
const BRANCH_NAME = env.BRANCH_NAME || "";
const SESV2_MAX_MESSAGE_SIZE_BYTES = 40 * 1024 * 1024;
const SESV2_SIZE_SAFETY_MARGIN_BYTES = 512 * 1024;
const SESV2_FORWARD_SIZE_LIMIT_BYTES =
  SESV2_MAX_MESSAGE_SIZE_BYTES - SESV2_SIZE_SAFETY_MARGIN_BYTES;
const OVERSIZE_HEADER_FETCH_RANGE_BYTES = 16 * 1024;
const UNKNOWN_SENDER_PLACEHOLDER_EMAIL = "unknown@example.com";
const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const dynamoBaseClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoBaseClient);
const db = createDb(docClient, CONTENT_TABLE_NAME);

const s3 = tracer.captureAWSv3Client(new S3Client({}));
const ses = tracer.captureAWSv3Client(new SESv2Client({}));

type ParsedOriginalSender = {
  name: string;
  email: string;
};

type ForwardSendResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
      target: string;
    };

type SendForwardedEmailInput = {
  rawMime: string;
  originalFrom: string;
  newFrom: string;
  target: string;
  s3Key: string;
  errorContext: {
    kind: "group" | "individual";
    toAddress?: string;
  };
};

/**
 * Hardcoded group aliases mapped to DynamoDB query predicates.
 */
async function resolveGroupAlias(localPart: string): Promise<string[] | null> {
  const resolvers: Record<string, () => Promise<string[]>> = {
    trainer: async () => {
      const result = await db.member.query
        .byType({ type: "member" })
        .where((attr, op) => op.eq(attr.isTrainer, true))
        .go({ pages: "all" });
      return result.data.filter((m) => m.privateEmail).map((m) => m.privateEmail as string);
    },
    vorstand: async () => {
      const result = await db.member.query
        .byType({ type: "member" })
        .where((attr, op) => op.eq(attr.isBoardMember, true))
        .go({ pages: "all" });
      return result.data.filter((m) => m.privateEmail).map((m) => m.privateEmail as string);
    },
    info: async () => {
      // info@ routes to trainers + board members (union, deduplicated).
      const [trainersResult, boardResult] = await Promise.all([
        db.member.query
          .byType({ type: "member" })
          .where((attr, op) => op.eq(attr.isTrainer, true))
          .go({ pages: "all" }),
        db.member.query
          .byType({ type: "member" })
          .where((attr, op) => op.eq(attr.isBoardMember, true))
          .go({ pages: "all" }),
      ]);
      const emails = new Set<string>();
      for (const m of [...trainersResult.data, ...boardResult.data]) {
        if (m.privateEmail) emails.add(m.privateEmail);
      }
      return Array.from(emails);
    },
  };

  const resolver = resolvers[localPart.toLowerCase()];
  if (!resolver) return null;
  return resolver();
}

/**
 * Strip the branch plus-address suffix from a local part so it can be matched
 * against a hardcoded group alias name (trainer, vorstand, info).
 *
 * Individual member aliases are stored in DDB **with** the suffix
 * (e.g. `max.mueller+feat-x@new.vcmuellheim.de`), so their lookup uses the raw
 * to-address unchanged. Only group-alias recognition needs the stripped form.
 */
function stripBranchSuffix(localPart: string): string {
  if (!BRANCH_NAME) return localPart;
  const suffix = `+${BRANCH_NAME}`;
  return localPart.endsWith(suffix) ? localPart.slice(0, -suffix.length) : localPart;
}

/**
 * Extract a single RFC 2822 header value (with folded continuation lines).
 */
function extractHeaderValue(rawMime: string, headerName: string): string {
  const lines = rawMime.split(/\r?\n/);
  let value = "";
  let collecting = false;
  const headerPattern = new RegExp(`^${headerName}:`, "i");

  for (const line of lines) {
    if (!line) break; // blank line = end of headers
    if (headerPattern.test(line)) {
      collecting = true;
      value = line.replace(headerPattern, "").trim();
    } else if (collecting && /^[ \t]/.test(line)) {
      value += ` ${line.trim()}`;
    } else if (collecting) {
      break;
    }
  }

  return value;
}

/**
 * Extract all To addresses from a raw MIME string.
 * Handles multiple comma-separated addresses and RFC 2822 folded headers.
 */
const EMAIL_ADDRESS_REGEX = /<([^<>]+@[^<>]+)>|([^\s,<>]+@[^\s,<>]+)/g;

function extractAddressesFromHeaderValue(headerValue: string): string[] {
  const addresses: string[] = [];
  for (const match of headerValue.matchAll(EMAIL_ADDRESS_REGEX)) {
    addresses.push((match[1] || match[2]).toLowerCase().trim());
  }
  return addresses;
}

function extractToAddresses(rawMime: string): string[] {
  const toLine = extractHeaderValue(rawMime, "to");

  if (!toLine) return [];
  return extractAddressesFromHeaderValue(toLine);
}

function extractRecipientAddressesFromHeader(rawMime: string, headerName: string): string[] {
  const line = extractHeaderValue(rawMime, headerName);
  if (!line) return [];
  return extractAddressesFromHeaderValue(line);
}

function dedupeAddresses(addresses: string[]): string[] {
  return Array.from(new Set(addresses));
}

function parseOriginalSender(originalFrom: string): ParsedOriginalSender {
  const normalizedOriginalFrom = originalFrom.replace(/\s+/g, " ").trim();
  const angleAddressMatch = normalizedOriginalFrom.match(/<([^<>]+@[^<>]+)>/);
  const bareAddressMatch = normalizedOriginalFrom.match(
    /(^|\s|"|'|\()([^\s<>]+@[^\s<>]+)(?=$|\s|"|'|\))/,
  );
  const originalEmail = sanitizeEmailAddress(
    (angleAddressMatch?.[1] || bareAddressMatch?.[2] || UNKNOWN_SENDER_PLACEHOLDER_EMAIL).trim(),
  );

  let originalName = "";
  if (angleAddressMatch) {
    const beforeAddress = normalizedOriginalFrom.slice(0, angleAddressMatch.index).trim();
    originalName = sanitizeHeaderDisplayText(beforeAddress.replace(/^"|"$/g, "").trim());
  }
  if (!originalName) {
    originalName = originalEmail.split("@")[0] || "unknown";
  }

  return {
    name: originalName,
    email: originalEmail,
  };
}

function stripControlCharacters(value: string): string {
  let stripped = "";
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code >= 0x20 && code !== 0x7f) {
      stripped += char;
    }
  }
  return stripped;
}

function sanitizeHeaderDisplayText(value: string): string {
  return stripControlCharacters(value).trim();
}

function sanitizeEmailAddress(email: string): string {
  return stripControlCharacters(email).trim();
}

function formatMailboxHeaderValue(name: string, email: string): string {
  const sanitizedEmail = sanitizeEmailAddress(email);
  const sanitizedName = sanitizeHeaderDisplayText(name);

  if (!sanitizedName || sanitizedName === sanitizedEmail.split("@")[0]) {
    return sanitizedEmail;
  }

  const escapedName = sanitizedName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escapedName}" <${sanitizedEmail}>`;
}

function canNotifySender(senderEmail: string): boolean {
  const normalizedSenderEmail = senderEmail.trim().toLowerCase();
  return (
    normalizedSenderEmail.length > 0 &&
    normalizedSenderEmail !== UNKNOWN_SENDER_PLACEHOLDER_EMAIL &&
    normalizedSenderEmail !== FORWARD_FROM_EMAIL.toLowerCase() &&
    BASIC_EMAIL_REGEX.test(normalizedSenderEmail)
  );
}

async function readMimeHeaderPrefix(params: {
  bucketName: string;
  s3Key: string;
}): Promise<string> {
  const { bucketName, s3Key } = params;

  const headerRangeResponse = await s3.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Range: `bytes=0-${OVERSIZE_HEADER_FETCH_RANGE_BYTES - 1}`,
    }),
  );

  if (!headerRangeResponse.Body) {
    return "";
  }

  return headerRangeResponse.Body.transformToString("utf-8");
}

async function notifySenderAboutOversizedEmail(params: {
  senderEmail: string;
  originalSubject: string;
  s3Key: string;
  messageSizeBytes: number;
}): Promise<void> {
  const { senderEmail, originalSubject, s3Key, messageSizeBytes } = params;

  if (!canNotifySender(senderEmail)) {
    return;
  }

  const sizeInMb = (messageSizeBytes / (1024 * 1024)).toFixed(2);
  const message = [
    "Hallo,",
    "",
    "deine E-Mail an vcmuellheim.de konnte nicht weitergeleitet werden,",
    `weil sie die maximal erlaubte Nachrichtengröße von ${(SESV2_FORWARD_SIZE_LIMIT_BYTES / (1024 * 1024)).toFixed(2)} MB überschreitet.`,
    "",
    `Erkannte Nachrichtengröße: ${sizeInMb} MB`,
    `Nachrichtenreferenz: ${s3Key}`,
    "",
    "Bitte reduziere die Größe der Anhänge und sende die E-Mail erneut.",
    "",
    "Dies ist eine automatische Benachrichtigung.",
  ].join("\n");

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: FORWARD_FROM_EMAIL,
      Destination: {
        ToAddresses: [senderEmail],
      },
      Content: {
        Simple: {
          Subject: {
            Data: `E-Mail nicht weitergeleitet (zu groß): ${originalSubject || "(ohne Betreff)"}`,
            Charset: "UTF-8",
          },
          Body: {
            Text: {
              Data: message,
              Charset: "UTF-8",
            },
          },
        },
      },
    }),
  );
}

function splitMimeIntoHeadersAndBody(rawMime: string): { headers: string; body: string } | null {
  const hasCrlfSeparator = rawMime.includes("\r\n\r\n");
  const separator = hasCrlfSeparator ? "\r\n\r\n" : "\n\n";
  const separatorIndex = rawMime.indexOf(separator);
  if (separatorIndex === -1) return null;

  return {
    headers: rawMime.slice(0, separatorIndex),
    body: rawMime.slice(separatorIndex),
  };
}

const BLOCKED_FORWARD_HEADER_PATTERN =
  /^(return-path|sender|dkim-signature|arc-seal|arc-message-signature|arc-authentication-results|authentication-results|received-spf|reply-to|cc|bcc|disposition-notification-to|return-receipt-to|x-original-to):/i;

function stripBlockedForwardHeaders(headers: string): string {
  const headerLines = headers.split(/\r?\n/);
  const strippedHeaders: string[] = [];
  let skipContinuation = false;

  for (const line of headerLines) {
    if (/^[ \t]/.test(line)) {
      if (!skipContinuation) {
        strippedHeaders.push(line);
      }
      continue;
    }

    skipContinuation = BLOCKED_FORWARD_HEADER_PATTERN.test(line);
    if (!skipContinuation) {
      strippedHeaders.push(line);
    }
  }

  return strippedHeaders.join("\r\n");
}

function buildForwardFromHeaderValue(originalFrom: string, newFrom: string): string {
  const sender = parseOriginalSender(originalFrom);
  const fromDisplayText = `${sender.name} (${sender.email})`;
  const escapedFromDisplayText = sanitizeHeaderDisplayText(fromDisplayText)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return `"${escapedFromDisplayText}" <${sanitizeEmailAddress(newFrom)}>`;
}

function buildReplyToHeaderValue(originalFrom: string): string {
  const sender = parseOriginalSender(originalFrom);
  return formatMailboxHeaderValue(sender.name, sender.email);
}

function applyForwardingHeaderRewrites(
  headers: string,
  originalFrom: string,
  rewrittenFrom: string,
  newTo: string,
): string {
  const sanitizedTo = sanitizeEmailAddress(newTo);
  const replyTo = buildReplyToHeaderValue(originalFrom);

  const rewritten = headers
    // Replace From header
    .replace(/^from:.*$/im, `From: ${rewrittenFrom}`)
    // Replace To header
    .replace(/^to:.*$/im, `To: ${sanitizedTo}`);

  return `${rewritten}\r\nReply-To: ${replyTo}`;
}

/**
 * Rewrite MIME headers for forwarding:
 * - Replace From with the verified domain sender
 * - Add Reply-To with the original From
 * - Replace To with the private destination
 */
function rewriteMimeHeaders(
  rawMime: string,
  originalFrom: string,
  newFrom: string,
  newTo: string,
): string {
  const sections = splitMimeIntoHeadersAndBody(rawMime);
  if (!sections) return rawMime;

  const strippedHeaders = stripBlockedForwardHeaders(sections.headers);
  const rewrittenFrom = buildForwardFromHeaderValue(originalFrom, newFrom);
  const rewrittenHeaders = applyForwardingHeaderRewrites(
    strippedHeaders,
    originalFrom,
    rewrittenFrom,
    newTo,
  );

  return rewrittenHeaders + sections.body;
}

/**
 * Extract the From address from a raw MIME string.
 * Handles RFC 2822 folded headers.
 */
function extractFromAddress(rawMime: string): string {
  const fromLine = extractHeaderValue(rawMime, "from");
  return fromLine || "unknown@example.com";
}

async function sendForwardedEmail(input: SendForwardedEmailInput): Promise<ForwardSendResult> {
  const { rawMime, originalFrom, newFrom, target, s3Key, errorContext } = input;
  const sanitizedTarget = sanitizeEmailAddress(target);

  try {
    const rewritten = rewriteMimeHeaders(rawMime, originalFrom, newFrom, sanitizedTarget);
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: newFrom,
        Destination: {
          ToAddresses: [sanitizedTarget],
        },
        Content: {
          Raw: {
            Data: Buffer.from(rewritten),
          },
        },
      }),
    );

    if (errorContext.kind === "group") {
      logger.info("Forwarded to group member", { target });
    } else {
      logger.info("Email forwarded", { s3Key, target });
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (errorContext.kind === "group") {
      logger.error("Failed to forward to group member", { target, error: message });
      Sentry.captureException(err, { extra: { target, s3Key } });
    } else {
      logger.error("Failed to forward individual alias", {
        toAddress: errorContext.toAddress,
        error: message,
      });
      Sentry.captureException(err, { extra: { toAddress: errorContext.toAddress, s3Key } });
    }

    return {
      success: false,
      error: message,
      target,
    };
  }
}

const lambdaHandler = async (event: unknown) => {
  const parsed = S3ObjectCreatedEventSchema.safeParse(event);
  if (!parsed.success) {
    logger.warn("Event does not match S3ObjectCreated shape — skipping", { error: parsed.error });
    return { statusCode: 200, body: "skipped: unexpected event shape" };
  }

  const { bucket, object } = parsed.data.detail;
  const s3Key = decodeURIComponent(object.key);
  const bucketName = bucket.name;

  logger.info("Processing inbound email", { bucket: bucketName, key: s3Key });
  Sentry.addBreadcrumb({ category: "mail", message: "Processing inbound email", data: { s3Key } });

  const s3Response = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: s3Key }));
  if (!s3Response.Body) {
    throw new Error(`S3 object body empty: ${s3Key}`);
  }

  const rawMimeContentLength = s3Response.ContentLength;
  if (
    typeof rawMimeContentLength === "number" &&
    rawMimeContentLength > SESV2_FORWARD_SIZE_LIMIT_BYTES
  ) {
    const headerPrefix = await readMimeHeaderPrefix({ bucketName, s3Key });
    const originalFrom = extractFromAddress(headerPrefix);
    const originalSubject = extractHeaderValue(headerPrefix, "subject");
    const sender = parseOriginalSender(originalFrom);

    logger.warn("Inbound mail exceeds SES v2 forwarding size limit (S3 metadata)", {
      s3Key,
      messageSizeBytes: rawMimeContentLength,
      senderEmail: sender.email,
      maxForwardSizeBytes: SESV2_FORWARD_SIZE_LIMIT_BYTES,
      metricMarker: "MailForwardOversizeDrop",
    });

    try {
      await notifySenderAboutOversizedEmail({
        senderEmail: sender.email,
        originalSubject,
        s3Key,
        messageSizeBytes: rawMimeContentLength,
      });
      logger.info("Sent oversized-mail notification to sender", {
        s3Key,
        senderEmail: sender.email,
        metricMarker: "MailForwardOversizeDropNotified",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to notify sender about oversized mail", {
        s3Key,
        senderEmail: sender.email,
        error: message,
      });
      Sentry.captureException(error, {
        extra: {
          s3Key,
          senderEmail: sender.email,
          messageSizeBytes: rawMimeContentLength,
        },
      });
    }

    return {
      statusCode: 200,
      body: "dropped: message too large",
    };
  }

  const rawMime = await s3Response.Body.transformToString("utf-8");
  const rawMimeSizeBytes = Buffer.byteLength(rawMime, "utf-8");

  if (rawMimeSizeBytes > SESV2_FORWARD_SIZE_LIMIT_BYTES) {
    const originalFrom = extractFromAddress(rawMime);
    const originalSubject = extractHeaderValue(rawMime, "subject");
    const sender = parseOriginalSender(originalFrom);

    logger.warn("Inbound mail exceeds SES v2 forwarding size limit", {
      s3Key,
      messageSizeBytes: rawMimeSizeBytes,
      senderEmail: sender.email,
      maxForwardSizeBytes: SESV2_FORWARD_SIZE_LIMIT_BYTES,
      metricMarker: "MailForwardOversizeDrop",
    });

    try {
      await notifySenderAboutOversizedEmail({
        senderEmail: sender.email,
        originalSubject,
        s3Key,
        messageSizeBytes: rawMimeSizeBytes,
      });
      logger.info("Sent oversized-mail notification to sender", {
        s3Key,
        senderEmail: sender.email,
        metricMarker: "MailForwardOversizeDropNotified",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to notify sender about oversized mail", {
        s3Key,
        senderEmail: sender.email,
        error: message,
      });
      Sentry.captureException(error, {
        extra: {
          s3Key,
          senderEmail: sender.email,
          messageSizeBytes: rawMimeSizeBytes,
        },
      });
    }

    return {
      statusCode: 200,
      body: "dropped: message too large",
    };
  }

  const envelopeRecipientAddresses = extractRecipientAddressesFromHeader(rawMime, "x-original-to");
  const headerToAddresses = extractToAddresses(rawMime);
  const headerToAddressSet = new Set(headerToAddresses.map((addr) => addr.toLowerCase()));
  const hasValidatedEnvelopeRecipient = envelopeRecipientAddresses.some((addr) =>
    headerToAddressSet.has(addr.toLowerCase()),
  );
  const toAddresses =
    envelopeRecipientAddresses.length > 0 && hasValidatedEnvelopeRecipient
      ? envelopeRecipientAddresses
      : headerToAddresses;
  const matchingAddresses = dedupeAddresses(
    toAddresses.filter((addr) => addr.split("@")[1] === RECIPIENT_DOMAIN),
  );

  if (matchingAddresses.length === 0) {
    logger.warn("No matching To addresses for recipient domain — dropping", { toAddresses, s3Key });
    return { statusCode: 200, body: "dropped: no matching To address" };
  }

  const originalFrom = extractFromAddress(rawMime);
  logger.info("Resolved recipients", { matchingAddresses, originalFrom });

  let totalSent = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  for (const toAddress of matchingAddresses) {
    const [rawLocalPart] = toAddress.split("@");
    if (!rawLocalPart) continue;

    // Strip branch suffix only to recognise group alias names (trainer, vorstand, info).
    // Individual aliases are stored in DDB WITH the suffix, so toAddress is used
    // directly for those lookups.
    const localPartForGroupCheck = stripBranchSuffix(rawLocalPart);

    // Try group alias resolution first (trainer@, vorstand@, info@)
    const groupTargets = await resolveGroupAlias(localPartForGroupCheck);
    if (groupTargets !== null) {
      if (groupTargets.length === 0) {
        logger.info("Group alias has no routable members — skipping", {
          localPart: localPartForGroupCheck,
        });
        continue;
      }

      logger.info("Forwarding to group alias recipients", {
        localPart: localPartForGroupCheck,
        count: groupTargets.length,
      });

      for (const target of groupTargets) {
        const result = await sendForwardedEmail({
          rawMime,
          originalFrom,
          newFrom: FORWARD_FROM_EMAIL,
          target,
          s3Key,
          errorContext: { kind: "group" },
        });

        if (result.success) {
          totalSent++;
        } else {
          allErrors.push(`${result.target}: ${result.error}`);
          totalFailed++;
        }
      }
      continue;
    }

    // Individual alias lookup via proxyEmail GSI.
    // toAddress already contains the branch suffix in dev (e.g. max.mueller+feat-x@new.vcmuellheim.de),
    // which matches what the admin stored when they confirmed the alias suggestion.
    const memberResult = await db.member.query.byProxyEmail({ proxyEmail: toAddress }).go();
    const member = memberResult.data?.[0];

    if (!member || !member.privateEmail) {
      logger.info("Unknown alias or no private email — skipping", { toAddress });
      continue;
    }

    logger.info("Forwarding individual alias", { toAddress, targetMember: member.id });
    const result = await sendForwardedEmail({
      rawMime,
      originalFrom,
      newFrom: FORWARD_FROM_EMAIL,
      target: member.privateEmail,
      s3Key,
      errorContext: { kind: "individual", toAddress },
    });

    if (result.success) {
      totalSent++;
    } else {
      allErrors.push(`${result.target}: ${result.error}`);
      totalFailed++;
    }
  }

  if (totalSent === 0 && totalFailed > 0) {
    throw new Error(`All forwards failed: ${allErrors.join("; ")}`);
  }
  if (totalFailed > 0) {
    logger.warn("Partial forwarding failure", { errors: allErrors });
  }

  return {
    statusCode: 200,
    body: totalSent > 0 ? `forwarded: ${totalSent}` : "dropped: no routable recipients",
  };
};

export const handler = Sentry.wrapHandler(
  middy(lambdaHandler)
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger, { logEvent: true })),
);
