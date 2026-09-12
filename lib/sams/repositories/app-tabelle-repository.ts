import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { getSamsTableName } from "@/lib/db/env";
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

  private entities() {
    const table = this.tableName ?? getSamsTableName();
    return createSamsDb(this.documentClient, table);
  }

  async listByDataset(datasetId: string = APP_DATASET_CURRENT): Promise<AppTabelleLeagueInput[]> {
    const result = await this.entities()
      .appTabelle.query.byDataset({ datasetId })
      .go({ pages: "all" });
    return result.data.map((item) =>
      parseWithSchema(appTabelleLeagueSchema, item, "Failed to parse app Tabelle league"),
    );
  }

  async replaceDataset(
    datasetId: string,
    leagues: AppTabelleLeagueUpsertInput[],
  ): Promise<AppTabelleLeagueInput[]> {
    const existing = await this.listByDataset(datasetId);
    const nextKeys = new Set(leagues.map((league) => league.leagueSortKey));

    for (const stale of existing) {
      if (!nextKeys.has(stale.leagueSortKey)) {
        await this.entities()
          .appTabelle.delete({ datasetId, leagueSortKey: stale.leagueSortKey })
          .go();
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
      await this.entities().appTabelle.put(item).go();
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
