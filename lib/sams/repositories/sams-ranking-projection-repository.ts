import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import { getItem, parseDomain, putItem } from "@/lib/db/repositories/dynamo-helpers";
import { samsRankingItemFromDomain, samsRankingKeys } from "@/lib/db/sams-keys";
import {
  samsLeagueRankingProjectionSchema,
  type SamsLeagueRankingProjectionInput,
} from "@/lib/db/schemas";
import {
  isoTimestampNow,
  parseWithSchema,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";

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

  private table(): string {
    return this.tableName ?? getSamsTableName();
  }

  async get(
    leagueUuid: string,
    seasonUuid: string,
  ): Promise<SamsLeagueRankingProjectionInput | null> {
    const raw = await getItem(
      this.documentClient,
      this.table(),
      samsRankingKeys(leagueUuid, seasonUuid),
    );
    if (!raw) return null;

    const parsed = samsLeagueRankingProjectionSchema.safeParse(
      parseDomain(samsLeagueRankingProjectionSchema, raw, "parse"),
    );
    if (!parsed.success) {
      console.warn("Failed to parse SAMS ranking projection; treating as missing", {
        leagueUuid,
        seasonUuid,
        issues: parsed.error.issues.map((issue) => issue.message),
      });
      return null;
    }
    return parsed.data;
  }

  async replace(input: SamsLeagueRankingUpsertInput): Promise<SamsLeagueRankingProjectionInput> {
    const item = parseWithSchema(
      samsLeagueRankingProjectionSchema,
      {
        ...input,
        type: "ranking",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
        ttl: input.ttl ?? unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
      },
      "Failed to parse SAMS ranking projection upsert input",
    );
    await putItem(this.documentClient, this.table(), samsRankingItemFromDomain(item));
    return item;
  }
}

export function createSamsRankingProjectionRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsRankingProjectionRepository {
  return new SamsRankingProjectionRepository(client, tableName);
}

export const samsRankingProjectionRepository = new SamsRankingProjectionRepository();
