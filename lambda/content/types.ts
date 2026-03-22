import { z } from "zod";
import { tableEnvironmentSchema } from "@/lib/db/env";
import { optionalEnvString, requiredEnvString } from "../utils/env";

export const TrpcLambdaEnvironmentSchema = tableEnvironmentSchema.extend({
	AWS_REGION: requiredEnvString,
	CDK_ENVIRONMENT: requiredEnvString,
	BETTER_AUTH_SECRET: requiredEnvString,
	MEDIA_BUCKET_NAME: requiredEnvString,
	CLOUDFRONT_URL: optionalEnvString,
	SAMS_CLUBS_TABLE_NAME: requiredEnvString,
	SAMS_TEAMS_TABLE_NAME: requiredEnvString,
});

export type TrpcLambdaEnvironment = z.infer<typeof TrpcLambdaEnvironmentSchema>;

export const IcsCalendarLambdaEnvironmentSchema = z.object({
	SAMS_API_URL: requiredEnvString,
	CONTENT_TABLE_NAME: requiredEnvString,
});

export type IcsCalendarLambdaEnvironment = z.infer<typeof IcsCalendarLambdaEnvironmentSchema>;

export const S3CleanupLambdaEnvironmentSchema = z.object({
	MEDIA_BUCKET_NAME: requiredEnvString,
});

export type S3CleanupLambdaEnvironment = z.infer<typeof S3CleanupLambdaEnvironmentSchema>;

export const ContentAuthEnvironmentSchema = z.object({
	AWS_REGION: requiredEnvString,
	BETTER_AUTH_SECRET: requiredEnvString,
});

export type ContentAuthEnvironment = z.infer<typeof ContentAuthEnvironmentSchema>;

export const BetterAuthAdapterEnvironmentSchema = z.object({
	CONTENT_TABLE_NAME: requiredEnvString,
});

export type BetterAuthAdapterEnvironment = z.infer<typeof BetterAuthAdapterEnvironmentSchema>;
