#!/usr/bin/env bun

/**
 * One-shot migration from ElectroDB item shape to native DocumentClient keys.
 *
 * Usage:
 *   vpr migrate:off-electrodb -- --dry-run
 *   CDK_ENVIRONMENT=prod AWS_PROFILE=vcm-prod vpr migrate:off-electrodb -- --apply
 */

import "varlock/auto-load";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { domainFieldsFromItem } from "@/lib/db/dynamo-item";
import {
  computeContentTableName,
  computeSamsDataTableName,
  getContentTableName,
  getSamsTableName,
} from "@/lib/db/env";
import * as contentKeys from "@/lib/db/content-keys";
import * as samsKeys from "@/lib/db/sams-keys";
import { getSanitizedBranch } from "@/utils/git";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const dryRun = args.includes("--dry-run") || !apply;

type TableTarget = "content" | "sams";

function stripElectroDb(item: Record<string, unknown>): Record<string, unknown> {
  const copy = domainFieldsFromItem(item);
  delete copy.__edb_e__;
  delete copy.__edb_v__;
  for (const key of Object.keys(copy)) {
    if (/^gsi[2-6](pk|sk)$/.test(key)) delete copy[key];
  }
  return copy;
}

function transformContentItem(item: Record<string, unknown>): Array<Record<string, unknown>> {
  const entity = item.__edb_e__;
  if (typeof entity !== "string") return [];

  const data = stripElectroDb(item);

  switch (entity) {
    case "news": {
      const parsed = data as never;
      return [contentKeys.newsItemFromDomain(parsed), contentKeys.newsSlugLookupFromDomain(parsed)];
    }
    case "event":
      return [contentKeys.eventItemFromDomain(data as never)];
    case "team": {
      const parsed = data as never;
      return [contentKeys.teamItemFromDomain(parsed), contentKeys.teamSlugLookupFromDomain(parsed)];
    }
    case "member": {
      const parsed = data as never;
      const rows: Array<Record<string, unknown>> = [contentKeys.memberItemFromDomain(parsed)];
      const privateIndex = contentKeys.memberEmailIndexFromDomain(parsed, "private");
      const proxyIndex = contentKeys.memberEmailIndexFromDomain(parsed, "proxy");
      if (privateIndex) rows.push(privateIndex);
      if (proxyIndex) rows.push(proxyIndex);
      return rows;
    }
    case "media":
      return [contentKeys.mediaItemFromDomain(data as never)];
    case "sponsor":
      return [contentKeys.sponsorItemFromDomain(data as never)];
    case "location":
      return [contentKeys.locationItemFromDomain(data as never)];
    case "bus":
      return [contentKeys.busItemFromDomain(data as never)];
    case "volunteerEvent":
      return [contentKeys.volunteerEventItemFromDomain(data as never)];
    case "volunteerSignup": {
      const parsed = data as never;
      return [
        contentKeys.volunteerSignupCollectionItemFromDomain(parsed),
        contentKeys.volunteerSignupIdLookupFromDomain(parsed),
      ];
    }
    case "volunteerToken":
      return [contentKeys.volunteerTokenItemFromDomain(data as never)];
    case "apiKey":
      return [contentKeys.apiKeyItemFromDomain(data as never)];
    case "publicsnapshot":
      return [contentKeys.publicSnapshotItemFromDomain(data as never)];
    default:
      throw new Error(`Unknown content entity __edb_e__=${entity}`);
  }
}

function transformSamsItem(item: Record<string, unknown>): Array<Record<string, unknown>> {
  const entity = item.__edb_e__;
  if (typeof entity !== "string") return [];
  const data = stripElectroDb(item);

  switch (entity) {
    case "samsclub":
      return [samsKeys.samsClubItemFromDomain(data as never)];
    case "samsteam":
      return [samsKeys.samsTeamItemFromDomain(data as never)];
    case "samsroster":
      return [samsKeys.samsRosterItemFromDomain(data as never)];
    case "samsschedule":
      return [samsKeys.samsScheduleItemFromDomain(data as never)];
    case "samsranking":
      return [samsKeys.samsRankingItemFromDomain(data as never)];
    case "samslogo":
      return [samsKeys.samsClubLogoItemFromDomain(data as never)];
    case "samsteamlogo":
      return [samsKeys.samsTeamLogoItemFromDomain(data as never)];
    case "apptabelle":
      return [samsKeys.appTabelleItemFromDomain(data as never)];
    case "apptermine":
      return [samsKeys.appTermineItemFromDomain(data as never)];
    case "appheimspiele":
      return [samsKeys.appHeimspieleItemFromDomain(data as never)];
    default:
      throw new Error(`Unknown SAMS entity __edb_e__=${entity}`);
  }
}

async function migrateTable(
  client: DynamoDBDocumentClient,
  tableName: string,
  target: TableTarget,
): Promise<{ scanned: number; migrated: number; skipped: number }> {
  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  let lastKey: Record<string, unknown> | undefined;

  do {
    const page = await client.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey,
      }),
    );
    for (const raw of page.Items ?? []) {
      scanned += 1;
      const item = raw as Record<string, unknown>;
      if (typeof item.__edb_e__ !== "string") {
        skipped += 1;
        continue;
      }
      const oldPk = item.pk;
      const oldSk = item.sk;
      if (typeof oldPk !== "string" || typeof oldSk !== "string") {
        throw new Error("ElectroDB item missing pk/sk");
      }
      const newItems = target === "content" ? transformContentItem(item) : transformSamsItem(item);

      if (dryRun) {
        console.log(`[dry-run] ${tableName} ${String(oldPk)} -> ${newItems.length} item(s)`);
      } else {
        for (const newItem of newItems) {
          await client.send(new PutCommand({ TableName: tableName, Item: newItem }));
        }
        await client.send(
          new DeleteCommand({ TableName: tableName, Key: { pk: oldPk, sk: oldSk } }),
        );
      }
      migrated += 1;
    }
    lastKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastKey);

  return { scanned, migrated, skipped };
}

async function main(): Promise<void> {
  const region = process.env.AWS_REGION || process.env.CDK_REGION || "eu-central-1";
  const env = process.env.CDK_ENVIRONMENT || "dev";
  const branch = getSanitizedBranch();
  const contentTable =
    env === "prod" ? getContentTableName() : computeContentTableName(env, branch);
  const samsTable = env === "prod" ? getSamsTableName() : computeSamsDataTableName(env, branch);

  console.log(`Mode: ${dryRun ? "dry-run" : "apply"}`);
  console.log(`Content: ${contentTable}`);
  console.log(`SAMS: ${samsTable}`);

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

  const contentStats = await migrateTable(client, contentTable, "content");
  const samsStats = await migrateTable(client, samsTable, "sams");

  console.log("Content", contentStats);
  console.log("SAMS", samsStats);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
