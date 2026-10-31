import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import { getItem, parseDomain, putItem } from "@/lib/db/repositories/dynamo-helpers";
import { samsScheduleItemFromDomain, samsScheduleKeys } from "@/lib/db/sams-keys";
import {
  samsClubScheduleProjectionSchema,
  type SamsClubScheduleProjectionInput,
  type SamsProjectionMatchInput,
} from "@/lib/db/schemas";
import {
  isoTimestampNow,
  parseWithSchema,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";

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

  private table(): string {
    return this.tableName ?? getSamsTableName();
  }

  private parseItem(value: unknown): SamsClubScheduleProjectionInput {
    return parseWithSchema(
      samsClubScheduleProjectionSchema,
      value,
      "Failed to parse SAMS schedule projection",
    );
  }

  async get(
    sportsclubUuid: string,
    seasonUuid: string,
  ): Promise<SamsClubScheduleProjectionInput | null> {
    const raw = await getItem(
      this.documentClient,
      this.table(),
      samsScheduleKeys(sportsclubUuid, seasonUuid),
    );
    if (!raw) return null;

    const parsed = samsClubScheduleProjectionSchema.safeParse(
      parseDomain(samsClubScheduleProjectionSchema, raw, "parse"),
    );
    if (!parsed.success) {
      console.warn("Failed to parse SAMS schedule projection; treating as missing", {
        sportsclubUuid,
        seasonUuid,
        issues: parsed.error.issues.map((issue) => issue.message),
      });
      return null;
    }
    return parsed.data;
  }

  async getSnapshotVersion(
    sportsclubUuid: string,
    seasonUuid: string,
  ): Promise<string | undefined> {
    const existing = await this.get(sportsclubUuid, seasonUuid);
    return existing?.snapshotVersion;
  }

  async replace(input: SamsClubScheduleUpsertInput): Promise<SamsClubScheduleProjectionInput> {
    const item = this.parseItem({
      ...input,
      type: "schedule",
      updatedAt: input.updatedAt ?? isoTimestampNow(),
      ttl: input.ttl ?? unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
    });
    await putItem(this.documentClient, this.table(), samsScheduleItemFromDomain(item));
    return item;
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
