import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, type PluginOption } from "vite-plus";
import {
  CACHE_TABLE_ENV_VAR,
  CONTENT_TABLE_ENV_VAR,
  computeCacheTableName,
  computeSamsDataTableName,
} from "../../lib/db/env.ts";
import { getSanitizedBranch } from "../../utils/git.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function getAppEnvironment(
  mode = process.env.NODE_ENV === "production" ? "production" : "development",
): string {
  const rootEnv = loadEnv(mode, repoRoot, "");

  for (const [name, value] of Object.entries(rootEnv)) {
    setDefaultEnv(name, value);
  }

  return process.env.CDK_ENVIRONMENT || "dev";
}

function setDefaultEnv(name: string, value: string) {
  if (!process.env[name]) {
    process.env[name] = value;
  }
}

function applyLocalAwsResourceEnv(environment: string) {
  if (environment === "prod") {
    return;
  }

  const sanitizedBranch = getSanitizedBranch();
  const branchSuffix = sanitizedBranch ? `-${sanitizedBranch}` : "";

  setDefaultEnv("BRANCH_NAME", sanitizedBranch);
  setDefaultEnv("VITE_BRANCH_NAME", sanitizedBranch);

  // Single content table for all entities
  setDefaultEnv(CONTENT_TABLE_ENV_VAR, `vcm-content-${environment}${branchSuffix}`);
  setDefaultEnv(CACHE_TABLE_ENV_VAR, computeCacheTableName(environment, sanitizedBranch));

  setDefaultEnv("SAMS_TABLE_NAME", computeSamsDataTableName(environment, sanitizedBranch));
  setDefaultEnv("MEDIA_BUCKET_NAME", `vcmuellheim-media-${environment}${branchSuffix}`);

  const envPrefix = `${environment}${branchSuffix}-`;
  setDefaultEnv("MEDIA_CLOUDFRONT_URL", `https://${envPrefix}media.new.vcmuellheim.de`);
}

export function localAwsResourceEnvPlugin(): PluginOption {
  return {
    name: "local-aws-resource-env",
    apply: "serve",
    config(_, configEnv) {
      applyLocalAwsResourceEnv(getAppEnvironment(configEnv.mode));
    },
  };
}
