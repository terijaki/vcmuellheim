import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { getSamsTableName } from "@/lib/db/env";
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

  private entities() {
    const table = this.tableName ?? getSamsTableName();
    return createSamsDb(this.documentClient, table);
  }

  async get(datasetId: string = APP_DATASET_CURRENT): Promise<AppHeimspieleInput | null> {
    const result = await this.entities()
      .appHeimspiele.get({ datasetId, documentKey: HEIMSPIELE_DOCUMENT_KEY })
      .go();
    if (!result.data) return null;
    return parseWithSchema(appHeimspieleSchema, result.data, "Failed to parse Heimspiele document");
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
    await this.entities().appHeimspiele.put(item).go();
    return item;
  }

  async delete(datasetId: string): Promise<void> {
    await this.entities()
      .appHeimspiele.delete({ datasetId, documentKey: HEIMSPIELE_DOCUMENT_KEY })
      .go();
  }
}

export function createAppHeimspieleRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): AppHeimspieleRepository {
  return new AppHeimspieleRepository(client, tableName);
}

export const appHeimspieleRepository = new AppHeimspieleRepository();
