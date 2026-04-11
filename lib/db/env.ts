/**
 * Shared type-safe configuration for DynamoDB tables.
 * Single source of truth used by both CDK and Lambda.
 *
 * All content entities share a single DynamoDB table (`CONTENT_TABLE_NAME`).
 * SAMS and social-media entities remain in their own stacks and tables.
 */

import { z } from "zod";

/** Environment variable name for the dedicated cache table */
export const CACHE_TABLE_ENV_VAR = "CACHE_TABLE_NAME" as const;

/** Get the cache table name from the environment, throwing if not configured */
export function getCacheTableName(): string {
	const tableName = process.env[CACHE_TABLE_ENV_VAR];
	if (!tableName) {
		throw new Error(`Cache table not configured. Missing environment variable: ${CACHE_TABLE_ENV_VAR}`);
	}
	return tableName;
}
/**
 * Compute the canonical cache table name for a given environment and branch.
 * Single source of truth used by CacheStack, WebAppStack, and SocialMediaStack.
 */
export function computeCacheTableName(environment: string, branch: string): string {
	const branchSuffix = branch ? `-${branch}` : "";
	return `vcm-cache-${environment}${branchSuffix}`;
}

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
/**
 * Compute the canonical content table name for a given environment and branch.
 * Single source of truth used by ContentDbStack, WebAppStack, MailStack, and SocialMediaStack
 * — keeping them in sync without a CloudFormation cross-stack reference.
 */
export function computeContentTableName(environment: string, branch: string): string {
	const branchSuffix = branch ? `-${branch}` : "";
	return `vcm-content-${environment}${branchSuffix}`;
}

/** Environment variable name for the single SAMS data table */
export const SAMS_TABLE_ENV_VAR = "SAMS_TABLE_NAME" as const;
/** Get the SAMS data table name from the environment, throwing if not configured */
export function getSamsTableName(): string {
	const tableName = process.env[SAMS_TABLE_ENV_VAR];
	if (!tableName) {
		throw new Error(`SAMS table not configured. Missing environment variable: ${SAMS_TABLE_ENV_VAR}`);
	}
	return tableName;
}
/**
 * Compute the canonical SAMS data table name for a given environment and branch.
 * Single source of truth used by SamsStack, WebAppStack, and the local dev
 * vite plugin — keeping them in sync without a CloudFormation cross-stack reference.
 */
export function computeSamsDataTableName(environment: string, branch: string): string {
	const branchSuffix = branch ? `-${branch}` : "";
	return `sams-data-${environment}${branchSuffix}`;
}
