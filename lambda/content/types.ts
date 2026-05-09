import { z } from "zod";
import { tableEnvironmentSchema } from "@/lib/db/env";
import { optionalEnvString, requiredEnvString } from "../utils/env";

export const TrpcLambdaEnvironmentSchema = tableEnvironmentSchema.extend({
  CDK_ENVIRONMENT: requiredEnvString,
  BETTER_AUTH_SECRET: requiredEnvString,
  MEDIA_BUCKET_NAME: requiredEnvString,
  MEDIA_CLOUDFRONT_URL: optionalEnvString,
  SAMS_TABLE_NAME: requiredEnvString,
});

export type TrpcLambdaEnvironment = z.infer<typeof TrpcLambdaEnvironmentSchema>;

export const S3CleanupLambdaEnvironmentSchema = z.object({
  CDK_ENVIRONMENT: optionalEnvString,
  MEDIA_BUCKET_NAME: requiredEnvString,
});

export type S3CleanupLambdaEnvironment = z.infer<typeof S3CleanupLambdaEnvironmentSchema>;

export const ContentAuthEnvironmentSchema = z.object({
  BETTER_AUTH_SECRET: requiredEnvString,
});

export type ContentAuthEnvironment = z.infer<typeof ContentAuthEnvironmentSchema>;
