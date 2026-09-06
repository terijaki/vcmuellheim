import type { PluginOption } from "vite-plus";
import {
  CONTENT_TABLE_ENV_VAR,
  SOCIAL_TABLE_ENV_VAR,
  computeSamsDataTableName,
  computeSocialTableName,
} from "../../lib/db/env.ts";
import { getSanitizedBranch } from "../../utils/git.ts";

function setDefaultEnv(name: string, value: string) {
  if (!process.env[name]) {
    process.env[name] = value;
  }
}

/**
 * Computes AWS resource names using the sanitized branch suffix.
 * Varlock already loads the raw branch name via $VARLOCK_BRANCH in the schema.
 * This plugin only handles resource naming that requires sanitization.
 */
export function localAwsResourceEnvPlugin(): PluginOption {
  return {
    name: "local-aws-resource-env",
    apply: "serve",
    config() {
      const environment = process.env.CDK_ENVIRONMENT || "dev";

      // Skip resource name computation in production
      if (environment === "prod") return;

      // Compute sanitized branch for resource names (e.g., DynamoDB tables, S3 buckets)
      const sanitizedBranch = getSanitizedBranch();
      const branchSuffix = sanitizedBranch ? `-${sanitizedBranch}` : "";

      // Set resource names that require the sanitized branch
      setDefaultEnv(CONTENT_TABLE_ENV_VAR, `vcm-content-${environment}${branchSuffix}`);
      setDefaultEnv(SOCIAL_TABLE_ENV_VAR, computeSocialTableName(environment, sanitizedBranch));
      setDefaultEnv("SAMS_TABLE_NAME", computeSamsDataTableName(environment, sanitizedBranch));
      setDefaultEnv("MEDIA_BUCKET_NAME", `vcmuellheim-media-${environment}${branchSuffix}`);

      const envPrefix = `${environment}${branchSuffix}-`;
      setDefaultEnv("MEDIA_CLOUDFRONT_URL", `https://${envPrefix}media.new.vcmuellheim.de`);
    },
  };
}
