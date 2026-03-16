/**
 * Shared type-safe configuration for DynamoDB tables
 * Single source of truth used by both CDK and Lambda
 */

import { z } from "zod";

/** All table entities in the system */
export const TABLES = ["NEWS", "EVENTS", "TEAMS", "MEMBERS", "MEDIA", "SPONSORS", "LOCATIONS", "BUS", "USERS", "AUTH_VERIFICATIONS"] as const;

export type TableEntity = (typeof TABLES)[number];
export type TableEnvVar = `${TableEntity}_TABLE_NAME`;
export type TableNamesByEntity = Record<TableEntity, string>;

export const tableEnvironmentSchema = z.object({
	NEWS_TABLE_NAME: z.string().trim().min(1),
	EVENTS_TABLE_NAME: z.string().trim().min(1),
	TEAMS_TABLE_NAME: z.string().trim().min(1),
	MEMBERS_TABLE_NAME: z.string().trim().min(1),
	MEDIA_TABLE_NAME: z.string().trim().min(1),
	SPONSORS_TABLE_NAME: z.string().trim().min(1),
	LOCATIONS_TABLE_NAME: z.string().trim().min(1),
	BUS_TABLE_NAME: z.string().trim().min(1),
	USERS_TABLE_NAME: z.string().trim().min(1),
	AUTH_VERIFICATIONS_TABLE_NAME: z.string().trim().min(1),
});

export type TableEnvironment = z.infer<typeof tableEnvironmentSchema>;

/** Get environment variable name for a table entity */
export function tableEnvVar(entity: TableEntity): TableEnvVar {
	return `${entity}_TABLE_NAME`;
}

/** Convert table names keyed by entity into Lambda environment variable names */
export function toTableEnvironment(tableNames: TableNamesByEntity): TableEnvironment {
	return {
		NEWS_TABLE_NAME: tableNames.NEWS,
		EVENTS_TABLE_NAME: tableNames.EVENTS,
		TEAMS_TABLE_NAME: tableNames.TEAMS,
		MEMBERS_TABLE_NAME: tableNames.MEMBERS,
		MEDIA_TABLE_NAME: tableNames.MEDIA,
		SPONSORS_TABLE_NAME: tableNames.SPONSORS,
		LOCATIONS_TABLE_NAME: tableNames.LOCATIONS,
		BUS_TABLE_NAME: tableNames.BUS,
		USERS_TABLE_NAME: tableNames.USERS,
		AUTH_VERIFICATIONS_TABLE_NAME: tableNames.AUTH_VERIFICATIONS,
	};
}
