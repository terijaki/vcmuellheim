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
import { SendRawEmailCommand, SESClient } from "@aws-sdk/client-ses";
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

const dynamoBaseClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoBaseClient);
const db = createDb(docClient, CONTENT_TABLE_NAME);

const s3 = tracer.captureAWSv3Client(new S3Client({}));
const ses = tracer.captureAWSv3Client(new SESClient({}));

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
	const regex = new RegExp(EMAIL_ADDRESS_REGEX);
	let match;
	while ((match = regex.exec(headerValue)) !== null) {
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
	const bareAddressMatch = normalizedOriginalFrom.match(/(^|\s|"|'|\()([^\s<>]+@[^\s<>]+)(?=$|\s|"|'|\))/);
	const originalEmail = (angleAddressMatch?.[1] || bareAddressMatch?.[2] || "unknown@example.com").trim();

	let originalName = "";
	if (angleAddressMatch) {
		const beforeAddress = normalizedOriginalFrom.slice(0, angleAddressMatch.index).trim();
		originalName = beforeAddress.replace(/^"|"$/g, "").trim();
	}
	if (!originalName) {
		originalName = originalEmail.split("@")[0] || "unknown";
	}

	return {
		name: originalName,
		email: originalEmail,
	};
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

		skipContinuation = /^(return-path|sender):/i.test(line);
		if (!skipContinuation) {
			strippedHeaders.push(line);
		}
	}

	return strippedHeaders.join("\r\n");
}

function buildForwardFromHeaderValue(originalFrom: string, newFrom: string): string {
	const sender = parseOriginalSender(originalFrom);
	const fromDisplayText = `${sender.name} (${sender.email})`;
	const escapedFromDisplayText = fromDisplayText.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	return `"${escapedFromDisplayText}" <${newFrom}>`;
}

function applyForwardingHeaderRewrites(headers: string, originalFrom: string, rewrittenFrom: string, newTo: string): string {
	let rewritten = headers
		// Replace From header
		.replace(/^from:.*$/im, `From: ${rewrittenFrom}`)
		// Replace To header
		.replace(/^to:.*$/im, `To: ${newTo}`);

	// Add Reply-To header if not already present
	if (!/^reply-to:/im.test(rewritten)) {
		rewritten += `\r\nReply-To: ${originalFrom}`;
	}

	return rewritten;
}

/**
 * Rewrite MIME headers for forwarding:
 * - Replace From with the verified domain sender
 * - Add Reply-To with the original From
 * - Replace To with the private destination
 */
function rewriteMimeHeaders(rawMime: string, originalFrom: string, newFrom: string, newTo: string): string {
	const sections = splitMimeIntoHeadersAndBody(rawMime);
	if (!sections) return rawMime;

	const strippedHeaders = stripBlockedForwardHeaders(sections.headers);
	const rewrittenFrom = buildForwardFromHeaderValue(originalFrom, newFrom);
	const rewrittenHeaders = applyForwardingHeaderRewrites(strippedHeaders, originalFrom, rewrittenFrom, newTo);

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

	try {
		const rewritten = rewriteMimeHeaders(rawMime, originalFrom, newFrom, target);
		await ses.send(
			new SendRawEmailCommand({
				Source: newFrom,
				Destinations: [target],
				RawMessage: { Data: Buffer.from(rewritten) },
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
			logger.error("Failed to forward individual alias", { toAddress: errorContext.toAddress, error: message });
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

	logger.info("Processing inbound email", { bucket: bucket.name, key: s3Key });
	Sentry.addBreadcrumb({ category: "mail", message: "Processing inbound email", data: { s3Key } });

	const s3Response = await s3.send(new GetObjectCommand({ Bucket: bucket.name, Key: s3Key }));
	if (!s3Response.Body) {
		throw new Error(`S3 object body empty: ${s3Key}`);
	}
	const rawMime = await s3Response.Body.transformToString("utf-8");

	const envelopeRecipientAddresses = extractRecipientAddressesFromHeader(rawMime, "x-original-to");
	const toAddresses = envelopeRecipientAddresses.length > 0 ? envelopeRecipientAddresses : extractToAddresses(rawMime);
	const matchingAddresses = dedupeAddresses(toAddresses.filter((addr) => addr.split("@")[1] === RECIPIENT_DOMAIN));

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
				logger.info("Group alias has no routable members — skipping", { localPart: localPartForGroupCheck });
				continue;
			}

			logger.info("Forwarding to group alias recipients", { localPart: localPartForGroupCheck, count: groupTargets.length });

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
