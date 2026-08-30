import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import {
  samsClubScheduleProjectionSchema,
  type SamsClubScheduleProjectionInput,
  type SamsProjectionMatchInput,
} from "@/lib/db/schemas";
import { samsSchedulePk, samsSeasonSk } from "@/lib/sams/key-constants";
import {
  isoTimestampNow,
  parseWithSchema,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";

function parseSchedule(value: unknown, message: string): SamsClubScheduleProjectionInput {
  return parseWithSchema(samsClubScheduleProjectionSchema, value, message);
}

export type SamsScheduleProjectionMeta = {
  snapshotVersion: string;
  projectedAt?: string;
  cachedAt?: string;
  isStale?: boolean;
};

export type SamsClubScheduleUpsertInput = Omit<
  SamsClubScheduleProjectionInput,
  "type" | "updatedAt" | "ttl"
> & {
  updatedAt?: string;
  ttl?: number;
};

export class SamsScheduleProjectionRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private resolveTableName(): string {
    return this.tableName ?? getSamsTableName();
  }

  private buildItem(input: SamsClubScheduleUpsertInput): SamsClubScheduleProjectionInput & {
    pk: string;
    sk: string;
  } {
    const item = parseSchedule(
      {
        ...input,
        type: "schedule",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
        ttl: input.ttl ?? unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
      },
      "Failed to parse SAMS schedule projection upsert input",
    );
    return {
      ...item,
      pk: samsSchedulePk(item.sportsclubUuid),
      sk: samsSeasonSk(item.seasonUuid),
    };
  }

  async get(
    sportsclubUuid: string,
    seasonUuid: string,
  ): Promise<SamsClubScheduleProjectionInput | null> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.resolveTableName(),
        Key: { pk: samsSchedulePk(sportsclubUuid), sk: samsSeasonSk(seasonUuid) },
      }),
    );
    if (!result.Item) return null;

    const parsed = samsClubScheduleProjectionSchema.safeParse(result.Item);
    if (!parsed.success) {
      console.warn("Failed to parse SAMS schedule projection; treating as missing", {
        sportsclubUuid,
        seasonUuid,
        issues: parsed.error.issues.map((issue: { message: string }) => issue.message),
      });
      return null;
    }
    return parsed.data;
  }

  async getSnapshotVersion(
    sportsclubUuid: string,
    seasonUuid: string,
  ): Promise<string | undefined> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.resolveTableName(),
        Key: { pk: samsSchedulePk(sportsclubUuid), sk: samsSeasonSk(seasonUuid) },
      }),
    );
    const snapshotVersion = result.Item?.snapshotVersion;
    return typeof snapshotVersion === "string" ? snapshotVersion : undefined;
  }

  async replace(input: SamsClubScheduleUpsertInput): Promise<SamsClubScheduleProjectionInput> {
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

  async mergeMatchesForClub(
    sportsclubUuid: string,
    seasonUuid: string,
    seasonName: string | undefined,
    matches: SamsProjectionMatchInput[],
    meta: SamsScheduleProjectionMeta,
  ): Promise<SamsClubScheduleProjectionInput> {
    const existing = await this.get(sportsclubUuid, seasonUuid);
    const mergedByUuid = new Map<string, SamsProjectionMatchInput>();
    for (const match of existing?.matches ?? []) {
      mergedByUuid.set(match.uuid, match);
    }
    for (const match of matches) {
      mergedByUuid.set(match.uuid, match);
    }
    return this.replace({
      sportsclubUuid,
      seasonUuid,
      seasonName: seasonName ?? existing?.seasonName,
      matches: [...mergedByUuid.values()],
      snapshotVersion: meta.snapshotVersion,
      projectedAt: meta.projectedAt ?? existing?.projectedAt,
      cachedAt: meta.cachedAt ?? existing?.cachedAt,
      isStale: meta.isStale ?? existing?.isStale,
    });
  }

  async listMatchesForSportsclubs(
    sportsclubUuids: readonly string[],
    seasonUuid?: string,
  ): Promise<SamsProjectionMatchInput[]> {
    const schedules = await Promise.all(
      sportsclubUuids.map(async (sportsclubUuid) => {
        if (!seasonUuid) return [];
        const schedule = await this.get(sportsclubUuid, seasonUuid);
        return schedule?.matches ?? [];
      }),
    );
    const byUuid = new Map<string, SamsProjectionMatchInput>();
    for (const matches of schedules) {
      for (const match of matches) {
        byUuid.set(match.uuid, match);
      }
    }
    return [...byUuid.values()];
  }
}

export function createSamsScheduleProjectionRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsScheduleProjectionRepository {
  return new SamsScheduleProjectionRepository(client, tableName);
}

export const samsScheduleProjectionRepository = new SamsScheduleProjectionRepository();
