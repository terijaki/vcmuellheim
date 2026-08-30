import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import { createSamsDb } from "@/lib/db/electrodb-client";
import { getSamsTableName } from "@/lib/db/env";
import { samsClubSchema, type SamsClubInput } from "@/lib/db/schemas";
import { isoTimestampNow, parseWithSchema } from "@/lib/sams/repository-utils";

export type SamsClubUpsertInput = Omit<SamsClubInput, "type" | "updatedAt"> & {
  updatedAt?: string;
};

function parseClub(value: unknown, message: string): SamsClubInput {
  return parseWithSchema(samsClubSchema, value, message);
}

export class SamsClubsRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private entities() {
    const table = this.tableName ?? getSamsTableName();
    return createSamsDb(this.documentClient, table);
  }

  async listAll(): Promise<SamsClubInput[]> {
    const result = await this.entities().club.query.byType({ type: "club" }).go({ pages: "all" });
    return result.data.map((item) => parseClub(item, "Failed to parse SAMS club list item"));
  }

  async getById(sportsclubUuid: string): Promise<SamsClubInput | null> {
    const result = await this.entities().club.get({ sportsclubUuid }).go();
    return result.data ? parseClub(result.data, "Failed to parse SAMS club data") : null;
  }

  async getByNameSlug(nameSlug: string): Promise<SamsClubInput | null> {
    const matches = await this.queryByNameSlugPrefix(nameSlug);
    const exactMatches = matches.filter((club) => club.nameSlug === nameSlug);
    if (exactMatches.length === 0) return null;
    return exactMatches.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  async queryByNameSlugPrefix(nameSlugPrefix: string): Promise<SamsClubInput[]> {
    const result = await this.entities()
      .club.query.byType({ type: "club" })
      .begins({ nameSlug: nameSlugPrefix })
      .go({ pages: "all" });
    return result.data.map((item) => parseClub(item, "Failed to parse SAMS club query item"));
  }

  async upsert(input: SamsClubUpsertInput): Promise<SamsClubInput> {
    const item = parseClub(
      {
        ...input,
        type: "club",
        updatedAt: input.updatedAt ?? isoTimestampNow(),
      },
      "Failed to parse SAMS club upsert input",
    );
    await this.entities().club.put(item).go();
    return item;
  }

  async upsertMany(inputs: SamsClubUpsertInput[]): Promise<void> {
    await Promise.all(inputs.map((input) => this.upsert(input)));
  }

  async delete(sportsclubUuid: string): Promise<void> {
    await this.entities().club.delete({ sportsclubUuid }).go();
  }
}

export const samsClubsRepository = new SamsClubsRepository();

export function createSamsClubsRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsClubsRepository {
  return new SamsClubsRepository(client, tableName);
}
