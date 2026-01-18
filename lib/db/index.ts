/**
 * Public exports for the content database layer
 */

// Client
export { docClient, dynamoDBClient, getTableName, TABLE_NAMES } from "./client";
// Repository instances and query helpers
export * from "./repositories";
export type { QueryOptions, RepositoryConfig, ScanOptions } from "./repository";

// Repository base class
export { Repository } from "./repository";
// Schemas
export * from "./schemas";
// Types
export * from "./types";
