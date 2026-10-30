import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import { deleteItem, getItem, parseDomain, putItem } from "@/lib/db/repositories/dynamo-helpers";
import { samsRosterItemFromDomain, samsRosterMainKeys } from "@/lib/db/sams-keys";
import { samsRosterSchema, type SamsRosterInput } from "@/lib/db/schemas";
import { isoTimestampNow, parseWithSchema } from "@/lib/sams/repository-utils";

export type SamsRosterUpsertInput = Omit<SamsRosterInput, "type" | "updatedAt"> & {
  updatedAt?: string;
};

export class SamsRostersRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table(): string {
    return this.tableName ?? getSamsTableName();
  }

  async getByTeamUuid(teamUuid: string): Promise<SamsRosterInput | null> {
    const item = await getItem(this.documentClient, this.table(), samsRosterMainKeys(teamUuid));
    return item
      ? parseWithSchema(
          samsRosterSchema,
          parseDomain(samsRosterSchema, item, "parse"),
          "Failed to parse SAMS roster data",
        )
      : null;
  }

  async upsert(input: SamsRosterUpsertInput): Promise<SamsRosterInput> {
    const item = parseWithSchema(
      samsRosterSchema,
      {
        ...input,
        type: "roster",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
      },
      "Failed to parse SAMS roster upsert input",
    );
    await putItem(this.documentClient, this.table(), samsRosterItemFromDomain(item));
    return item;
  }

  async delete(teamUuid: string): Promise<void> {
    await deleteItem(this.documentClient, this.table(), samsRosterMainKeys(teamUuid));
  }
}

export const samsRostersRepository = new SamsRostersRepository();

export function createSamsRostersRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsRostersRepository {
  return new SamsRostersRepository(client, tableName);
}
