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
  teamUuid?: string;
};

const DEFAULT_PAGE_SIZE = 50;

function matchInvolvesTeam(match: AppTermineMatchInput, teamUuid: string): boolean {
  return match.team1.uuid === teamUuid || match.team2.uuid === teamUuid;
}

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

  /**
   * Query the current (or given) Termine dataset.
   * Uses DynamoDB begins_with for past/future partitions, FilterExpression for
   * home-only, and paginated Limit — not pages:"all" + slice.
   */
  async query(options: AppTermineQueryOptions = {}): Promise<AppTermineMatchInput[]> {
    const datasetId = options.datasetId ?? APP_DATASET_CURRENT;
    const rangePrefix =
      options.range === "past" ? "P#" : options.range === "future" ? "F#" : undefined;
    const order = (options.range === "past" ? "desc" : "asc") as "asc" | "desc";
    const needsPostFilter = Boolean(options.teamUuid);
    const targetCount = options.limit;

    const collected: AppTermineMatchInput[] = [];
    let cursor: string | null = null;

    do {
      const remaining =
        targetCount === undefined ? DEFAULT_PAGE_SIZE : Math.max(targetCount - collected.length, 1);
      // When FilterExpression or post-filters drop items, over-fetch a bit per page.
      const pageLimit =
        options.homeOnly || needsPostFilter
          ? Math.min(DEFAULT_PAGE_SIZE, remaining * 3)
          : remaining;

      const baseQuery = this.entities().appTermine.query.byDataset({ datasetId });
      const rangedQuery = rangePrefix ? baseQuery.begins({ matchSortKey: rangePrefix }) : baseQuery;
      const filteredQuery = options.homeOnly
        ? rangedQuery.where(({ isHomeGame }, { eq }) => eq(isHomeGame, true))
        : rangedQuery;

      // Annotate the page result to avoid ElectroDB's circular cursor inference.
      const result: { data: unknown[]; cursor: string | null } = await filteredQuery.go({
        order,
        limit: pageLimit,
        cursor,
        pages: 1,
      });

      let page = result.data.map((item) =>
        parseWithSchema(appTermineMatchSchema, item, "Failed to parse app Termine match"),
      );
      const teamUuid = options.teamUuid;
      if (teamUuid) {
        page = page.filter((match) => matchInvolvesTeam(match, teamUuid));
      }

      for (const match of page) {
        collected.push(match);
        if (targetCount !== undefined && collected.length >= targetCount) {
          return collected.slice(0, targetCount);
        }
      }

      cursor = result.cursor;
    } while (cursor);

    return targetCount === undefined ? collected : collected.slice(0, targetCount);
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
