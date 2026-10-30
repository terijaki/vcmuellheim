import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import { deleteItem, getItem, parseDomain, putItem } from "@/lib/db/repositories/dynamo-helpers";
import { appHeimspieleItemFromDomain, appHeimspieleKeys } from "@/lib/db/sams-keys";
import {
  APP_DATASET_CURRENT,
  appHeimspieleSchema,
  HEIMSPIELE_DOCUMENT_KEY,
  type AppHeimspieleInput,
  type HeimspielCard,
} from "@/lib/db/schemas";
import {
  isoTimestampNow,
  parseWithSchema,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";

export class AppHeimspieleRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table(): string {
    return this.tableName ?? getSamsTableName();
  }

  async get(datasetId: string = APP_DATASET_CURRENT): Promise<AppHeimspieleInput | null> {
    const item = await getItem(
      this.documentClient,
      this.table(),
      appHeimspieleKeys(datasetId, HEIMSPIELE_DOCUMENT_KEY),
    );
    if (!item) return null;
    return parseWithSchema(
      appHeimspieleSchema,
      parseDomain(appHeimspieleSchema, item, "parse"),
      "Failed to parse Heimspiele document",
    );
  }

  async put(
    datasetId: string,
    games: HeimspielCard[],
    meta?: { updatedAt?: string; ttl?: number },
  ): Promise<AppHeimspieleInput> {
    const item = parseWithSchema(
      appHeimspieleSchema,
      {
        datasetId,
        documentKey: HEIMSPIELE_DOCUMENT_KEY,
        type: "appheimspiele",
        games,
        updatedAt: meta?.updatedAt ?? isoTimestampNow(),
        ttl: meta?.ttl ?? unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
      },
      "Failed to parse Heimspiele document",
    );
    await putItem(this.documentClient, this.table(), appHeimspieleItemFromDomain(item));
    return item;
  }

  async delete(datasetId: string): Promise<void> {
    await deleteItem(
      this.documentClient,
      this.table(),
      appHeimspieleKeys(datasetId, HEIMSPIELE_DOCUMENT_KEY),
    );
  }
}

export const appHeimspieleRepository = new AppHeimspieleRepository();

export function createAppHeimspieleRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): AppHeimspieleRepository {
  return new AppHeimspieleRepository(client, tableName);
}
