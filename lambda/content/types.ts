import { z } from "zod";
import { tableEnvironmentSchema } from "@/lib/db/env";
import { optionalEnvString, requiredEnvString } from "../utils/env";

const logLevelSchema = z.enum(["DEBUG", "INFO", "WARN", "ERROR"]);

export const TrpcLambdaEnvironmentSchema = tableEnvironmentSchema.extend({
	LOG_LEVEL: logLevelSchema.optional(),
	POWERTOOLS_TRACE_ENABLED: optionalEnvString,
	AWS_REGION: optionalEnvString,
	CDK_ENVIRONMENT: requiredEnvString,
	BETTER_AUTH_SECRET: requiredEnvString,
	MEDIA_BUCKET_NAME: optionalEnvString,
	CLOUDFRONT_URL: optionalEnvString,
	SAMS_CLUBS_TABLE_NAME: optionalEnvString,
	SAMS_TEAMS_TABLE_NAME: optionalEnvString,
});

export type TrpcLambdaEnvironment = z.infer<typeof TrpcLambdaEnvironmentSchema>;

export const IcsCalendarLambdaEnvironmentSchema = z.object({
	SAMS_API_URL: requiredEnvString,
	TEAMS_TABLE_NAME: requiredEnvString,
	EVENTS_TABLE_NAME: requiredEnvString,
	POWERTOOLS_TRACE_ENABLED: optionalEnvString,
});

export type IcsCalendarLambdaEnvironment = z.infer<typeof IcsCalendarLambdaEnvironmentSchema>;

export const SitemapLambdaEnvironmentSchema = tableEnvironmentSchema.extend({
	WEBSITE_URL: requiredEnvString,
	LOG_LEVEL: logLevelSchema.optional(),
	POWERTOOLS_TRACE_ENABLED: optionalEnvString,
});

export type SitemapLambdaEnvironment = z.infer<typeof SitemapLambdaEnvironmentSchema>;

export const S3CleanupLambdaEnvironmentSchema = z.object({
	MEDIA_BUCKET_NAME: requiredEnvString,
});

export type S3CleanupLambdaEnvironment = z.infer<typeof S3CleanupLambdaEnvironmentSchema>;

export const ContentAuthEnvironmentSchema = z.object({
	AWS_REGION: optionalEnvString,
	BETTER_AUTH_SECRET: requiredEnvString,
});

export type ContentAuthEnvironment = z.infer<typeof ContentAuthEnvironmentSchema>;

export const BetterAuthAdapterEnvironmentSchema = z.object({
	USERS_TABLE_NAME: requiredEnvString,
	AUTH_VERIFICATIONS_TABLE_NAME: requiredEnvString,
});

export type BetterAuthAdapterEnvironment = z.infer<typeof BetterAuthAdapterEnvironmentSchema>;
