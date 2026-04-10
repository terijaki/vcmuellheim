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
const ses = tracer.captureAWSv3Client(new SESClient({ region: env.AWS_REGION }));

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
 * Extract all To addresses from a raw MIME string.
 * Handles multiple comma-separated addresses and RFC 2822 folded headers.
 */
function extractToAddresses(rawMime: string): string[] {
	const lines = rawMime.split(/\r?\n/);
	let toLine = "";
	let collecting = false;

	for (const line of lines) {
		if (!line) break; // blank line = end of headers
		if (/^to:/i.test(line)) {
			collecting = true;
			toLine = line.replace(/^to:\s*/i, "");
		} else if (collecting && /^[ \t]/.test(line)) {
			toLine += " " + line.trim(); // folded continuation
		} else if (collecting) {
			break; // next non-folded header ends To
		}
	}

	if (!toLine) return [];
	const addresses: string[] = [];
	const regex = /<([^>@]+@[^>]+)>|([^\s,<>]+@[^\s,<>]+)/g;
	let match;
	while ((match = regex.exec(toLine)) !== null) {
		addresses.push((match[1] || match[2]).toLowerCase().trim());
	}
	return addresses;
}

/**
 * Rewrite MIME headers for forwarding:
 * - Replace From with the verified domain sender
 * - Add Reply-To with the original From
 * - Replace To with the private destination
 */
function rewriteMimeHeaders(rawMime: string, originalFrom: string, newFrom: string, newTo: string): string {
	const headerBodySplit = rawMime.indexOf("\r\n\r\n") !== -1 ? rawMime.indexOf("\r\n\r\n") : rawMime.indexOf("\n\n");
	if (headerBodySplit === -1) return rawMime;

	const headers = rawMime.slice(0, headerBodySplit);
	const body = rawMime.slice(headerBodySplit);
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

	let rewritten = strippedHeaders
		.join("\r\n")
		// Replace From header
		.replace(/^from:.*$/im, `From: ${newFrom}`)
		// Replace To header
		.replace(/^to:.*$/im, `To: ${newTo}`);

	// Add Reply-To header if not already present
	if (!/^reply-to:/im.test(rewritten)) {
		rewritten = rewritten.replace(/^from:.*$/im, (fromLine) => `${fromLine}\r\nReply-To: ${originalFrom}`);
	}

	return rewritten + body;
}

/**
 * Extract the From address from a raw MIME string.
 * Handles RFC 2822 folded headers.
 */
function extractFromAddress(rawMime: string): string {
	const lines = rawMime.split(/\r?\n/);
	let fromLine = "";
	let collecting = false;

	for (const line of lines) {
		if (!line) break;
		if (/^from:/i.test(line)) {
			collecting = true;
			fromLine = line.replace(/^from:\s*/i, "").trim();
		} else if (collecting && /^[ \t]/.test(line)) {
			fromLine += " " + line.trim();
		} else if (collecting) {
			break;
		}
	}

	return fromLine || "unknown@example.com";
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

	const toAddresses = extractToAddresses(rawMime);
	const matchingAddresses = toAddresses.filter((addr) => addr.split("@")[1] === RECIPIENT_DOMAIN);

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
				try {
					const rewritten = rewriteMimeHeaders(rawMime, originalFrom, FORWARD_FROM_EMAIL, target);
					await ses.send(
						new SendRawEmailCommand({
							Source: FORWARD_FROM_EMAIL,
							Destinations: [target],
							RawMessage: { Data: Buffer.from(rewritten) },
						}),
					);
					logger.info("Forwarded to group member", { target });
					totalSent++;
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					allErrors.push(`${target}: ${msg}`);
					totalFailed++;
					logger.error("Failed to forward to group member", { target, error: msg });
					Sentry.captureException(err, { extra: { target, s3Key } });
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

		try {
			logger.info("Forwarding individual alias", { toAddress, targetMember: member.id });
			const rewritten = rewriteMimeHeaders(rawMime, originalFrom, FORWARD_FROM_EMAIL, member.privateEmail);
			await ses.send(
				new SendRawEmailCommand({
					Source: FORWARD_FROM_EMAIL,
					Destinations: [member.privateEmail],
					RawMessage: { Data: Buffer.from(rewritten) },
				}),
			);
			logger.info("Email forwarded", { s3Key, target: member.privateEmail });
			totalSent++;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			allErrors.push(`${member.privateEmail}: ${msg}`);
			totalFailed++;
			logger.error("Failed to forward individual alias", { toAddress, error: msg });
			Sentry.captureException(err, { extra: { toAddress, s3Key } });
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

export const handler = middy(lambdaHandler)
	.use(captureLambdaHandler(tracer))
	.use(injectLambdaContext(logger, { logEvent: true }));
