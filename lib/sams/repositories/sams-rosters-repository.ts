import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { getSamsTableName } from "@/lib/db/env";
import { samsRosterSchema, type SamsRosterInput } from "@/lib/db/schemas";
import { isoTimestampNow, parseWithSchema } from "@/lib/sams/repository-utils";

export type SamsRosterUpsertInput = Omit<SamsRosterInput, "type" | "updatedAt"> & {
  updatedAt?: string;
};

function parseRoster(value: unknown, message: string): SamsRosterInput {
  return parseWithSchema(samsRosterSchema, value, message);
}

export class SamsRostersRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private entities() {
    const table = this.tableName ?? getSamsTableName();
    return createSamsDb(this.documentClient, table);
  }

  async getByTeamUuid(teamUuid: string): Promise<SamsRosterInput | null> {
    const result = await this.entities().roster.get({ teamUuid }).go();
    return result.data ? parseRoster(result.data, "Failed to parse SAMS roster data") : null;
  }

  async upsert(input: SamsRosterUpsertInput): Promise<SamsRosterInput> {
    const item = parseRoster(
      {
        ...input,
        type: "roster",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
      },
      "Failed to parse SAMS roster upsert input",
    );
    await this.entities().roster.put(item).go();
    return item;
  }

  async delete(teamUuid: string): Promise<void> {
    await this.entities().roster.delete({ teamUuid }).go();
  }
}

export const samsRostersRepository = new SamsRostersRepository();

export function createSamsRostersRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsRostersRepository {
  return new SamsRostersRepository(client, tableName);
}
