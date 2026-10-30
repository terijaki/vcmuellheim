import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { getSamsTableName } from "@/lib/db/env";
import { samsTeamLogoSchema, type SamsTeamLogoInput } from "@/lib/db/schemas";
import {
  isoTimestampNow,
  parseWithSchema,
  SAMS_PROJECTION_TTL_DAYS,
  unixTtlSecondsFromNow,
} from "@/lib/sams/repository-utils";

export type SamsTeamLogoUpsertInput = Omit<SamsTeamLogoInput, "type" | "updatedAt" | "ttl"> & {
  updatedAt?: string;
  ttl?: number;
};

export class SamsTeamLogoRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private entities() {
    const table = this.tableName ?? getSamsTableName();
    return createSamsDb(this.documentClient, table);
  }

  async get(teamUuid: string): Promise<SamsTeamLogoInput | null> {
    const result = await this.entities().teamLogo.get({ teamUuid }).go();
    return result.data
      ? parseWithSchema(samsTeamLogoSchema, result.data, "Failed to parse SAMS team logo")
      : null;
  }

  async upsert(input: SamsTeamLogoUpsertInput): Promise<SamsTeamLogoInput> {
    const item = parseWithSchema(
      samsTeamLogoSchema,
      {
        ...input,
        type: "samsteamlogo",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
        ttl: input.ttl ?? unixTtlSecondsFromNow(SAMS_PROJECTION_TTL_DAYS),
      },
      "Failed to parse SAMS team logo upsert input",
    );
    await this.entities().teamLogo.put(item).go();
    return item;
  }
}

export const samsTeamLogoRepository = new SamsTeamLogoRepository();

export function createSamsTeamLogoRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsTeamLogoRepository {
  return new SamsTeamLogoRepository(client, tableName);
}
