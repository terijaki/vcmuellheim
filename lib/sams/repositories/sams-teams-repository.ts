import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import {
  deleteItem,
  getItem,
  parseDomain,
  putItem,
  queryGsi1,
} from "@/lib/db/repositories/dynamo-helpers";
import { samsTeamItemFromDomain, samsTeamMainKeys } from "@/lib/db/sams-keys";
import { SamsTableIndexes } from "@/lib/db/table-indexes";
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

  private table(): string {
    return this.tableName ?? getSamsTableName();
  }

  async listAll(): Promise<SamsTeamInput[]> {
    const page = await queryGsi1(this.documentClient, this.table(), {
      gsi1pk: "samsTeam",
      indexName: SamsTableIndexes.gsi1,
    });
    return page.items.map((item) =>
      parseWithSchema(
        samsTeamSchema,
        parseDomain(samsTeamSchema, item, "parse"),
        "Failed to parse SAMS team list item",
      ),
    );
  }

  async getById(uuid: string): Promise<SamsTeamInput | null> {
    const item = await getItem(this.documentClient, this.table(), samsTeamMainKeys(uuid));
    return item
      ? parseWithSchema(
          samsTeamSchema,
          parseDomain(samsTeamSchema, item, "parse"),
          "Failed to parse SAMS team data",
        )
      : null;
  }

  async getByNameSlug(nameSlug: string): Promise<SamsTeamInput | null> {
    const matches = await this.queryByNameSlugPrefix(nameSlug);
    return matches.find((team) => team.nameSlug === nameSlug) ?? null;
  }

  async queryByNameSlugPrefix(nameSlugPrefix: string): Promise<SamsTeamInput[]> {
    const page = await queryGsi1(this.documentClient, this.table(), {
      gsi1pk: "samsTeam",
      beginsWithGsi1sk: nameSlugPrefix,
      indexName: SamsTableIndexes.gsi1,
    });
    return page.items.map((item) =>
      parseWithSchema(
        samsTeamSchema,
        parseDomain(samsTeamSchema, item, "parse"),
        "Failed to parse SAMS team query item",
      ),
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
    await putItem(this.documentClient, this.table(), samsTeamItemFromDomain(item));
    return item;
  }

  async upsertMany(inputs: SamsTeamUpsertInput[]): Promise<void> {
    await Promise.all(inputs.map((input) => this.upsert(input)));
  }

  async delete(uuid: string): Promise<void> {
    await deleteItem(this.documentClient, this.table(), samsTeamMainKeys(uuid));
  }
}

export const samsTeamsRepository = new SamsTeamsRepository();

export function createSamsTeamsRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsTeamsRepository {
  return new SamsTeamsRepository(client, tableName);
}
