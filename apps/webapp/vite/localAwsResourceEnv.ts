import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, type PluginOption } from "vite";
import { TABLES, type TableEntity, tableEnvVar } from "../../../lib/db/env";
import { getSanitizedBranch } from "../../../utils/git";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const contentTableNamesByEntity: Record<TableEntity, string> = {
	NEWS: "news",
	EVENTS: "events",
	TEAMS: "teams",
	MEMBERS: "members",
	MEDIA: "media",
	SPONSORS: "sponsors",
	LOCATIONS: "locations",
	BUS: "bus",
	USERS: "users",
	AUTH_VERIFICATIONS: "auth-verifications",
};

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

	for (const entity of TABLES) {
		setDefaultEnv(tableEnvVar(entity), `vcm-${contentTableNamesByEntity[entity]}-${environment}${branchSuffix}`);
	}

	setDefaultEnv("SAMS_CLUBS_TABLE_NAME", `sams-clubs-${environment}${branchSuffix}`);
	setDefaultEnv("SAMS_TEAMS_TABLE_NAME", `sams-teams-${environment}${branchSuffix}`);
	setDefaultEnv("INSTAGRAM_TABLE_NAME", `instagram-posts-${environment}${branchSuffix}`);
	setDefaultEnv("MEDIA_BUCKET_NAME", `vcmuellheim-media-${environment}${branchSuffix}`);
	setDefaultEnv("SAMS_SERVER", "https://www.volleyball-baden.de");
	setDefaultEnv("CLOUDFRONT_URL", `https://${environment}-tanstack-start-media.new.vcmuellheim.de`);
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
