import { TABLES, type TableEntity, tableEnvVar } from "../../../lib/db/env";
import { getSanitizedBranch } from "../../../utils/git";
import type { PluginOption } from "vite";

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

export function getAppEnvironment(): string {
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
}

export function localAwsResourceEnvPlugin(): PluginOption {
	return {
		name: "local-aws-resource-env",
		apply: "serve",
		config() {
			applyLocalAwsResourceEnv(getAppEnvironment());
		},
	};
}