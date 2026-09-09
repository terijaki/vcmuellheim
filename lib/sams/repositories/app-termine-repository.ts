import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { getSamsTableName } from "@/lib/db/env";
import {
  APP_DATASET_CURRENT,
  appTermineMatchSchema,
  type AppTermineMatchInput,
} from "@/lib/db/schemas";
import {
  isoTimestampNow,
  parseWithSchema,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";

export type AppTermineMatchUpsertInput = Omit<
  AppTermineMatchInput,
  "type" | "updatedAt" | "ttl"
> & {
  updatedAt?: string;
  ttl?: number;
};

export type AppTermineQueryOptions = {
  datasetId?: string;
  range?: "past" | "future";
  limit?: number;
  homeOnly?: boolean;
};

export class AppTermineRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private entities() {
    const table = this.tableName ?? getSamsTableName();
    return createSamsDb(this.documentClient, table);
  }

  async listByDataset(datasetId: string = APP_DATASET_CURRENT): Promise<AppTermineMatchInput[]> {
    const result = await this.entities()
      .appTermine.query.byDataset({ datasetId })
      .go({ pages: "all" });
    return result.data.map((item) =>
      parseWithSchema(appTermineMatchSchema, item, "Failed to parse app Termine match"),
    );
  }

  async query(options: AppTermineQueryOptions = {}): Promise<AppTermineMatchInput[]> {
    const datasetId = options.datasetId ?? APP_DATASET_CURRENT;
    const rangePrefix =
      options.range === "past" ? "P#" : options.range === "future" ? "F#" : undefined;
    const goOptions = {
      pages: "all" as const,
      order: (options.range === "past" ? "desc" : "asc") as "asc" | "desc",
    };

    const baseQuery = this.entities().appTermine.query.byDataset({ datasetId });
    const result = rangePrefix
      ? await baseQuery.begins({ matchSortKey: rangePrefix }).go(goOptions)
      : await baseQuery.go(goOptions);

    let matches = result.data.map((item) =>
      parseWithSchema(appTermineMatchSchema, item, "Failed to parse app Termine match"),
    );

    if (options.homeOnly) {
      matches = matches.filter((match) => match.isHomeGame);
    }

    if (options.limit !== undefined) {
      matches = matches.slice(0, options.limit);
    }

    return matches;
  }

  async replaceDataset(
    datasetId: string,
    matches: AppTermineMatchUpsertInput[],
  ): Promise<AppTermineMatchInput[]> {
    const existing = await this.listByDataset(datasetId);
    const nextKeys = new Set(matches.map((match) => match.matchSortKey));

    for (const stale of existing) {
      if (!nextKeys.has(stale.matchSortKey)) {
        await this.entities()
          .appTermine.delete({ datasetId, matchSortKey: stale.matchSortKey })
          .go();
      }
    }

    const written: AppTermineMatchInput[] = [];
    for (const match of matches) {
      const item = parseWithSchema(
        appTermineMatchSchema,
        {
          ...match,
          datasetId,
          type: "apptermine",
          updatedAt: match.updatedAt ?? isoTimestampNow(),
          ttl: match.ttl ?? unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
        },
        "Failed to parse app Termine upsert input",
      );
      await this.entities().appTermine.put(item).go();
      written.push(item);
    }
    return written;
  }
}

export function createAppTermineRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): AppTermineRepository {
  return new AppTermineRepository(client, tableName);
}

export const appTermineRepository = new AppTermineRepository();
