import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import {
  deleteItem,
  parseDomain,
  putItem,
  queryTablePk,
} from "@/lib/db/repositories/dynamo-helpers";
import { appTabelleItemFromDomain, appTabelleKeys } from "@/lib/db/sams-keys";
import {
  APP_DATASET_CURRENT,
  appTabelleLeagueSchema,
  type AppTabelleLeagueInput,
} from "@/lib/db/schemas";
import {
  isoTimestampNow,
  parseWithSchema,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";

export type AppTabelleLeagueUpsertInput = Omit<
  AppTabelleLeagueInput,
  "type" | "updatedAt" | "ttl"
> & {
  updatedAt?: string;
  ttl?: number;
};

export class AppTabelleRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table(): string {
    return this.tableName ?? getSamsTableName();
  }

  async listByDataset(datasetId: string = APP_DATASET_CURRENT): Promise<AppTabelleLeagueInput[]> {
    const page = await queryTablePk(this.documentClient, this.table(), {
      pk: `appTabelle#${datasetId}`,
    });
    return page.items.map((item) =>
      parseWithSchema(
        appTabelleLeagueSchema,
        parseDomain(appTabelleLeagueSchema, item, "parse"),
        "Failed to parse app Tabelle league",
      ),
    );
  }

  async replaceDataset(
    datasetId: string,
    leagues: AppTabelleLeagueUpsertInput[],
  ): Promise<AppTabelleLeagueInput[]> {
    const existing = await this.listByDataset(datasetId);
    const nextKeys = new Set(leagues.map((league) => league.leagueSortKey));
    const table = this.table();

    for (const stale of existing) {
      if (!nextKeys.has(stale.leagueSortKey)) {
        await deleteItem(
          this.documentClient,
          table,
          appTabelleKeys(datasetId, stale.leagueSortKey),
        );
      }
    }

    const written: AppTabelleLeagueInput[] = [];
    for (const league of leagues) {
      const item = parseWithSchema(
        appTabelleLeagueSchema,
        {
          ...league,
          datasetId,
          type: "apptabelle",
          updatedAt: league.updatedAt ?? isoTimestampNow(),
          ttl: league.ttl ?? unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
        },
        "Failed to parse app Tabelle upsert input",
      );
      await putItem(this.documentClient, table, appTabelleItemFromDomain(item));
      written.push(item);
    }
    return written;
  }
}

export function createAppTabelleRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): AppTabelleRepository {
  return new AppTabelleRepository(client, tableName);
}

export const appTabelleRepository = new AppTabelleRepository();
