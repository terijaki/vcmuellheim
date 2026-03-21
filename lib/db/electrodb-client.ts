/**
 * Configured ElectroDB service factory
 *
 * Usage (webapp server functions / routes):
 *   import { db } from "@/lib/db/electrodb-client";
 *   const { data: news } = await db().news.query.byType({ type: "article" }).go({ limit: 10 });
 *
 * Usage (Lambda handlers that provide their own DynamoDB client):
 *   import { createDb } from "@/lib/db/electrodb-client";
 *   const entities = createDb(docClient, CONTENT_TABLE_NAME);
 *   const { data } = await entities.event.query.byType({ type: "event" }).go();
 */

import { Service } from "electrodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./client";
import { getContentTableName } from "./env";
import {
  AuthVerificationEntity,
  BusEntity,
  CmsUserEntity,
  EventEntity,
  LocationEntity,
  MediaEntity,
  MemberEntity,
  NewsEntity,
  SessionEntity,
  SponsorEntity,
  TeamEntity,
} from "./electrodb-entities";

/** All entities registered in the service */
const entityMap = {
  news: NewsEntity,
  event: EventEntity,
  team: TeamEntity,
  member: MemberEntity,
  media: MediaEntity,
  sponsor: SponsorEntity,
  location: LocationEntity,
  bus: BusEntity,
  user: CmsUserEntity,
  verification: AuthVerificationEntity,
  session: SessionEntity,
} as const;

/**
 * Create a configured ElectroDB service connected to the given DynamoDB client and table.
 * Returns the `entities` object so individual entities can be used directly.
 */
export function createDb(client: DynamoDBDocumentClient, tableName: string) {
  return new Service(entityMap, { client, table: tableName }).entities;
}

// Singleton for webapp (uses the shared docClient and CONTENT_TABLE_NAME env var)
let _db: ReturnType<typeof createDb> | null = null;

/**
 * Returns the singleton ElectroDB entity map for the webapp.
 * Lazily initialised on first call so the CONTENT_TABLE_NAME env var
 * can be set by tests before the module is first evaluated.
 */
export function db(): ReturnType<typeof createDb> {
  if (!_db) {
    _db = createDb(docClient, getContentTableName());
  }
  return _db;
}
