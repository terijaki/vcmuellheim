import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import { getItem, parseDomain, putItem } from "@/lib/db/repositories/dynamo-helpers";
import { samsTeamLogoItemFromDomain, samsTeamLogoMainKeys } from "@/lib/db/sams-keys";
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

  private table(): string {
    return this.tableName ?? getSamsTableName();
  }

  async get(teamUuid: string): Promise<SamsTeamLogoInput | null> {
    const item = await getItem(this.documentClient, this.table(), samsTeamLogoMainKeys(teamUuid));
    return item
      ? parseWithSchema(
          samsTeamLogoSchema,
          parseDomain(samsTeamLogoSchema, item, "parse"),
          "Failed to parse SAMS team logo",
        )
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
    await putItem(this.documentClient, this.table(), samsTeamLogoItemFromDomain(item));
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
