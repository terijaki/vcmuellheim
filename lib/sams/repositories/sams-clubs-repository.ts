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
import { samsClubItemFromDomain, samsClubMainKeys } from "@/lib/db/sams-keys";
import { SamsTableIndexes } from "@/lib/db/table-indexes";
import { samsClubSchema, type SamsClubInput } from "@/lib/db/schemas";
import { isoTimestampNow, parseWithSchema } from "@/lib/sams/repository-utils";

export type SamsClubUpsertInput = Omit<SamsClubInput, "type" | "updatedAt"> & {
  updatedAt?: string;
};

export class SamsClubsRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table(): string {
    return this.tableName ?? getSamsTableName();
  }

  async listAll(): Promise<SamsClubInput[]> {
    const page = await queryGsi1(this.documentClient, this.table(), {
      gsi1pk: "samsClub",
      indexName: SamsTableIndexes.gsi1,
    });
    return page.items.map((item) =>
      parseWithSchema(
        samsClubSchema,
        parseDomain(samsClubSchema, item, "parse"),
        "Failed to parse SAMS club list item",
      ),
    );
  }

  async getById(sportsclubUuid: string): Promise<SamsClubInput | null> {
    const item = await getItem(this.documentClient, this.table(), samsClubMainKeys(sportsclubUuid));
    return item
      ? parseWithSchema(
          samsClubSchema,
          parseDomain(samsClubSchema, item, "parse"),
          "Failed to parse SAMS club data",
        )
      : null;
  }

  async getByNameSlug(nameSlug: string): Promise<SamsClubInput | null> {
    const matches = await this.queryByNameSlugPrefix(nameSlug);
    const exactMatches = matches.filter((club) => club.nameSlug === nameSlug);
    if (exactMatches.length === 0) return null;
    return exactMatches.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  async queryByNameSlugPrefix(nameSlugPrefix: string): Promise<SamsClubInput[]> {
    const page = await queryGsi1(this.documentClient, this.table(), {
      gsi1pk: "samsClub",
      beginsWithGsi1sk: nameSlugPrefix,
      indexName: SamsTableIndexes.gsi1,
    });
    return page.items.map((item) =>
      parseWithSchema(
        samsClubSchema,
        parseDomain(samsClubSchema, item, "parse"),
        "Failed to parse SAMS club query item",
      ),
    );
  }

  async upsert(input: SamsClubUpsertInput): Promise<SamsClubInput> {
    const item = parseWithSchema(
      samsClubSchema,
      {
        ...input,
        type: "club",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
      },
      "Failed to parse SAMS club upsert input",
    );
    await putItem(this.documentClient, this.table(), samsClubItemFromDomain(item));
    return item;
  }

  async upsertMany(inputs: SamsClubUpsertInput[]): Promise<void> {
    await Promise.all(inputs.map((input) => this.upsert(input)));
  }

  async delete(sportsclubUuid: string): Promise<void> {
    await deleteItem(this.documentClient, this.table(), samsClubMainKeys(sportsclubUuid));
  }
}

export const samsClubsRepository = new SamsClubsRepository();

export function createSamsClubsRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsClubsRepository {
  return new SamsClubsRepository(client, tableName);
}
