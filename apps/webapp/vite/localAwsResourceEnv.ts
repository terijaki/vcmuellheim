import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, type PluginOption } from "vite-plus";
import { CONTENT_TABLE_ENV_VAR } from "../../../lib/db/env.ts";
import { Club } from "../../../project.config.ts";
import { getSanitizedBranch } from "../../../utils/git.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function getAppEnvironment(mode = process.env.NODE_ENV === "production" ? "production" : "development"): string {
	const rootEnv = loadEnv(mode, repoRoot, "");

	for (const [name, value] of Object.entries(rootEnv)) {
		setDefaultEnv(name, value);
	}

	return process.env.VITE_CDK_ENVIRONMENT || process.env.CDK_ENVIRONMENT || "dev";
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

	// Single content table for all entities
	setDefaultEnv(CONTENT_TABLE_ENV_VAR, `vcm-content-${environment}${branchSuffix}`);

	setDefaultEnv("SAMS_CLUBS_TABLE_NAME", `sams-clubs-${environment}${branchSuffix}`);
	setDefaultEnv("SAMS_TEAMS_TABLE_NAME", `sams-teams-${environment}${branchSuffix}`);
	setDefaultEnv("INSTAGRAM_TABLE_NAME", `instagram-posts-${environment}${branchSuffix}`);
	setDefaultEnv("MEDIA_BUCKET_NAME", `vcmuellheim-media-${environment}${branchSuffix}`);
	setDefaultEnv("SAMS_SERVER", "https://www.volleyball-baden.de");

	const isProd = environment === "prod";
	const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;
	const baseDomain = isProd ? Club.domain : `new.${Club.domain}`;
	setDefaultEnv("CLOUDFRONT_URL", `https://${envPrefix}media.${baseDomain}`);
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
