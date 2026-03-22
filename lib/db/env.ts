/**
 * Shared type-safe configuration for DynamoDB tables.
 * Single source of truth used by both CDK and Lambda.
 *
 * All content entities share a single DynamoDB table (`CONTENT_TABLE_NAME`).
 * SAMS and social-media entities remain in their own stacks and tables.
 */

import { z } from "zod";

/** Environment variable name for the single content table */
export const CONTENT_TABLE_ENV_VAR = "CONTENT_TABLE_NAME" as const;

export const tableEnvironmentSchema = z.object({
	CONTENT_TABLE_NAME: z.string().trim().min(1),
});

export type TableEnvironment = z.infer<typeof tableEnvironmentSchema>;

/** Get the single content table name from the environment, throwing if not configured */
export function getContentTableName(): string {
	const tableName = process.env[CONTENT_TABLE_ENV_VAR];
	if (!tableName) {
		throw new Error(`Content table not configured. Missing environment variable: ${CONTENT_TABLE_ENV_VAR}`);
	}
	return tableName;
}

// ---------------------------------------------------------------------------
// Legacy compatibility — kept so existing callers (server functions, lambdas)
// that still use tableEnvVar() continue to compile without changes.
// All entity keys resolve to the same single content table.
// ---------------------------------------------------------------------------

/** All content entity keys (kept for legacy compatibility) */
export const TABLES = ["NEWS", "EVENTS", "TEAMS", "MEMBERS", "MEDIA", "SPONSORS", "LOCATIONS", "BUS", "USERS", "AUTH_VERIFICATIONS"] as const;

export type TableEntity = (typeof TABLES)[number];

/** Returns the single content table env var for any entity (single-table design) */
export function tableEnvVar(_entity: TableEntity): typeof CONTENT_TABLE_ENV_VAR {
	return CONTENT_TABLE_ENV_VAR;
}
