import { z } from "zod";
import { optionalEnvString, requiredEnvString } from "../utils/env";

// ============================================================================
// Lambda Environment Contracts
// ============================================================================

export const MailForwardLambdaEnvironmentSchema = z.object({
	CDK_ENVIRONMENT: optionalEnvString,
	/** Branch name injected at deploy time for non-prod; absent in prod. */
	BRANCH_NAME: optionalEnvString,
	/** DynamoDB content table (for member proxy email lookups). */
	CONTENT_TABLE_NAME: requiredEnvString,
	/** Verified SES identity used as the forwarding From address. */
	FORWARD_FROM_EMAIL: requiredEnvString,
	/** Recipient domain — used for group alias routing (e.g. "vcmuellheim.de"). */
	RECIPIENT_DOMAIN: requiredEnvString,
	AWS_REGION: requiredEnvString,
});

export type MailForwardLambdaEnvironment = z.infer<typeof MailForwardLambdaEnvironmentSchema>;

// ============================================================================
// EventBridge S3 event shape
// ============================================================================

/** Minimal EventBridge S3 Object Created notification */
export const S3ObjectCreatedEventSchema = z.object({
	detail: z.object({
		bucket: z.object({ name: z.string() }),
		object: z.object({ key: z.string() }),
	}),
});

export type S3ObjectCreatedEvent = z.infer<typeof S3ObjectCreatedEventSchema>;
