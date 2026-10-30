import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import {
  deleteItem,
  parseDomain,
  putItem,
  queryTablePk,
} from "@/lib/db/repositories/dynamo-helpers";
import { appTermineItemFromDomain, appTermineKeys } from "@/lib/db/sams-keys";
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

  private table(): string {
    return this.tableName ?? getSamsTableName();
  }

  async listByDataset(datasetId: string = APP_DATASET_CURRENT): Promise<AppTermineMatchInput[]> {
    const page = await queryTablePk(this.documentClient, this.table(), {
      pk: `appTermine#${datasetId}`,
    });
    return page.items.map((item) =>
      parseWithSchema(
        appTermineMatchSchema,
        parseDomain(appTermineMatchSchema, item, "parse"),
        "Failed to parse app Termine match",
      ),
    );
  }

  async query(options: AppTermineQueryOptions = {}): Promise<AppTermineMatchInput[]> {
    const datasetId = options.datasetId ?? APP_DATASET_CURRENT;
    const rangePrefix =
      options.range === "past" ? "P#" : options.range === "future" ? "F#" : undefined;
    const order = options.range === "past" ? false : true;
    const needsPostFilter = Boolean(options.teamUuid);
    const targetCount = options.limit;

    const collected: AppTermineMatchInput[] = [];
    let cursor: string | undefined;

    do {
      const remaining =
        targetCount === undefined ? DEFAULT_PAGE_SIZE : Math.max(targetCount - collected.length, 1);
      const pageLimit =
        options.homeOnly || needsPostFilter
          ? Math.min(DEFAULT_PAGE_SIZE, remaining * 3)
          : remaining;

      const page = await queryTablePk(this.documentClient, this.table(), {
        pk: `appTermine#${datasetId}`,
        beginsWithSk: rangePrefix,
        scanIndexForward: order,
        limit: pageLimit,
        cursor,
        filterExpression: options.homeOnly ? "isHomeGame = :home" : undefined,
        expressionAttributeValues: options.homeOnly ? { ":home": true } : undefined,
      });

      let batch = page.items.map((item) =>
        parseWithSchema(
          appTermineMatchSchema,
          parseDomain(appTermineMatchSchema, item, "parse"),
          "Failed to parse app Termine match",
        ),
      );
      const teamUuid = options.teamUuid;
      if (teamUuid) {
        batch = batch.filter((match) => matchInvolvesTeam(match, teamUuid));
      }

      for (const match of batch) {
        collected.push(match);
        if (targetCount !== undefined && collected.length >= targetCount) {
          return collected.slice(0, targetCount);
        }
      }

      cursor = page.cursor;
    } while (cursor);

    return targetCount === undefined ? collected : collected.slice(0, targetCount);
  }

  async replaceDataset(
    datasetId: string,
    matches: AppTermineMatchUpsertInput[],
  ): Promise<AppTermineMatchInput[]> {
    const existing = await this.listByDataset(datasetId);
    const nextKeys = new Set(matches.map((match) => match.matchSortKey));
    const table = this.table();

    for (const stale of existing) {
      if (!nextKeys.has(stale.matchSortKey)) {
        await deleteItem(this.documentClient, table, appTermineKeys(datasetId, stale.matchSortKey));
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
      await putItem(this.documentClient, table, appTermineItemFromDomain(item));
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
