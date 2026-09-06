import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { getSamsTableName } from "@/lib/db/env";
import { samsTeamSchema, type SamsTeamInput } from "@/lib/db/schemas";
import { isoTimestampNow, parseWithSchema } from "@/lib/sams/repository-utils";

export type SamsTeamUpsertInput = Omit<SamsTeamInput, "type" | "updatedAt"> & {
  updatedAt?: string;
};

export class SamsTeamsRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private entities() {
    const table = this.tableName ?? getSamsTableName();
    return createSamsDb(this.documentClient, table);
  }

  async listAll(): Promise<SamsTeamInput[]> {
    const result = await this.entities().team.query.byType({ type: "team" }).go({ pages: "all" });
    return result.data.map((item) =>
      parseWithSchema(samsTeamSchema, item, "Failed to parse SAMS team list item"),
    );
  }

  async getById(uuid: string): Promise<SamsTeamInput | null> {
    const result = await this.entities().team.get({ uuid }).go();
    return result.data
      ? parseWithSchema(samsTeamSchema, result.data, "Failed to parse SAMS team data")
      : null;
  }

  async getByNameSlug(nameSlug: string): Promise<SamsTeamInput | null> {
    const matches = await this.queryByNameSlugPrefix(nameSlug);
    return matches.find((team) => team.nameSlug === nameSlug) ?? null;
  }

  async queryByNameSlugPrefix(nameSlugPrefix: string): Promise<SamsTeamInput[]> {
    const result = await this.entities()
      .team.query.byType({ type: "team" })
      .begins({ nameSlug: nameSlugPrefix })
      .go({ pages: "all" });
    return result.data.map((item) =>
      parseWithSchema(samsTeamSchema, item, "Failed to parse SAMS team query item"),
    );
  }

  async upsert(input: SamsTeamUpsertInput): Promise<SamsTeamInput> {
    const item = parseWithSchema(
      samsTeamSchema,
      {
        ...input,
        type: "team",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
      },
      "Failed to parse SAMS team upsert input",
    );
    await this.entities().team.put(item).go();
    return item;
  }

  async upsertMany(inputs: SamsTeamUpsertInput[]): Promise<void> {
    await Promise.all(inputs.map((input) => this.upsert(input)));
  }

  async delete(uuid: string): Promise<void> {
    await this.entities().team.delete({ uuid }).go();
  }
}

export const samsTeamsRepository = new SamsTeamsRepository();

export function createSamsTeamsRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsTeamsRepository {
  return new SamsTeamsRepository(client, tableName);
}
