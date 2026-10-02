import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { getSamsTableName } from "@/lib/db/env";
import { samsClubLogoSchema, type SamsClubLogoInput } from "@/lib/db/schemas";
import {
  isoTimestampNow,
  parseWithSchema,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";

export type SamsClubLogoUpsertInput = Omit<SamsClubLogoInput, "type" | "updatedAt" | "ttl"> & {
  updatedAt?: string;
  ttl?: number;
};

export class SamsClubLogoRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private entities() {
    const table = this.tableName ?? getSamsTableName();
    return createSamsDb(this.documentClient, table);
  }

  async get(sportsclubUuid: string): Promise<SamsClubLogoInput | null> {
    const result = await this.entities().clubLogo.get({ sportsclubUuid }).go();
    return result.data
      ? parseWithSchema(samsClubLogoSchema, result.data, "Failed to parse SAMS club logo")
      : null;
  }

  async upsert(input: SamsClubLogoUpsertInput): Promise<SamsClubLogoInput> {
    const item = parseWithSchema(
      samsClubLogoSchema,
      {
        ...input,
        type: "samslogo",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
        ttl: input.ttl ?? unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
      },
      "Failed to parse SAMS club logo upsert input",
    );
    await this.entities().clubLogo.put(item).go();
    return item;
  }
}

export const samsClubLogoRepository = new SamsClubLogoRepository();

export function createSamsClubLogoRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsClubLogoRepository {
  return new SamsClubLogoRepository(client, tableName);
}
