import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import {
  samsLeagueRankingProjectionSchema,
  type SamsLeagueRankingProjectionInput,
  type SamsProjectionRankingEntryInput,
} from "@/lib/db/schemas";
import { samsRankingPk, samsSeasonSk } from "@/lib/sams/key-constants";
import {
  isoTimestampNow,
  parseWithSchema,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";

function parseRanking(value: unknown, message: string): SamsLeagueRankingProjectionInput {
  return parseWithSchema(samsLeagueRankingProjectionSchema, value, message);
}

export type SamsLeagueRankingUpsertInput = Omit<
  SamsLeagueRankingProjectionInput,
  "type" | "updatedAt" | "ttl"
> & {
  updatedAt?: string;
  ttl?: number;
};

export class SamsRankingProjectionRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private resolveTableName(): string {
    return this.tableName ?? getSamsTableName();
  }

  private buildItem(input: SamsLeagueRankingUpsertInput): SamsLeagueRankingProjectionInput & {
    pk: string;
    sk: string;
  } {
    const item = parseRanking(
      {
        ...input,
        type: "ranking",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
        ttl: input.ttl ?? unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
      },
      "Failed to parse SAMS ranking projection upsert input",
    );
    return {
      ...item,
      pk: samsRankingPk(item.leagueUuid),
      sk: samsSeasonSk(item.seasonUuid),
    };
  }

  async get(
    leagueUuid: string,
    seasonUuid: string,
  ): Promise<SamsLeagueRankingProjectionInput | null> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.resolveTableName(),
        Key: { pk: samsRankingPk(leagueUuid), sk: samsSeasonSk(seasonUuid) },
      }),
    );
    if (!result.Item) return null;

    const parsed = samsLeagueRankingProjectionSchema.safeParse(result.Item);
    if (!parsed.success) {
      console.warn("Failed to parse SAMS ranking projection; treating as missing", {
        leagueUuid,
        seasonUuid,
        issues: parsed.error.issues.map((issue: { message: string }) => issue.message),
      });
      return null;
    }
    return parsed.data;
  }

  async replace(input: SamsLeagueRankingUpsertInput): Promise<SamsLeagueRankingProjectionInput> {
    const item = this.buildItem(input);
    await this.documentClient.send(
      new PutCommand({
        TableName: this.resolveTableName(),
        Item: item,
      }),
    );
    const { pk: _pk, sk: _sk, ...stored } = item;
    return stored;
  }

  async replaceTeams(
    leagueUuid: string,
    seasonUuid: string,
    seasonName: string | undefined,
    leagueName: string | undefined,
    teams: SamsProjectionRankingEntryInput[],
    meta: { snapshotVersion: string; cachedAt?: string; isStale?: boolean },
  ): Promise<SamsLeagueRankingProjectionInput> {
    return this.replace({
      leagueUuid,
      seasonUuid,
      seasonName,
      leagueName,
      teams,
      snapshotVersion: meta.snapshotVersion,
      cachedAt: meta.cachedAt,
      isStale: meta.isStale,
    });
  }
}

export function createSamsRankingProjectionRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsRankingProjectionRepository {
  return new SamsRankingProjectionRepository(client, tableName);
}

export const samsRankingProjectionRepository = new SamsRankingProjectionRepository();
