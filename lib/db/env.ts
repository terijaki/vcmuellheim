/**
 * Shared type-safe configuration for DynamoDB tables
 * Single source of truth used by both CDK and Lambda
 */

/** All table entities in the system */
export const TABLES = ["NEWS", "EVENTS", "TEAMS", "MEMBERS", "MEDIA", "SPONSORS", "LOCATIONS", "BUS"] as const;

export type TableEntity = (typeof TABLES)[number];

/** Get environment variable name for a table entity */
export function tableEnvVar(entity: TableEntity): string {
	return `${entity}_TABLE_NAME`;
}
