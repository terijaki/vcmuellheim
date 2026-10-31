import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import {
  teamItemFromDomain,
  teamMainKeys,
  teamSlugLookupFromDomain,
  teamSlugLookupKeys,
} from "@/lib/db/content-keys";
import { getContentTableName } from "@/lib/db/env";
import { teamSchema } from "@/lib/db/schemas";
import type { Team } from "@/lib/db/types";
import {
  deleteItem,
  getItem,
  parseDomain,
  putItem,
  queryGsi1,
} from "@/lib/db/repositories/dynamo-helpers";

export class TeamRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table(): string {
    return this.tableName ?? getContentTableName();
  }

  async getById(id: string): Promise<Team | null> {
    const item = await getItem(this.documentClient, this.table(), teamMainKeys(id));
    return item ? parseDomain(teamSchema, item, "Failed to parse team") : null;
  }

  async getBySlug(slug: string): Promise<Team | null> {
    const lookup = await getItem(this.documentClient, this.table(), teamSlugLookupKeys(slug));
    if (!lookup || typeof lookup.id !== "string") return null;
    return this.getById(lookup.id);
  }

  async listAll(): Promise<Team[]> {
    const page = await queryGsi1(this.documentClient, this.table(), {
      gsi1pk: "team",
      scanIndexForward: true,
    });
    return page.items.map((item) => parseDomain(teamSchema, item, "Failed to parse team"));
  }

  async create(team: Team): Promise<Team> {
    const parsed = teamSchema.parse(team);
    await putItem(this.documentClient, this.table(), teamItemFromDomain(parsed));
    await putItem(this.documentClient, this.table(), teamSlugLookupFromDomain(parsed));
    return parsed;
  }

  async update(id: string, updates: Partial<Team>): Promise<Team | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = teamSchema.parse({ ...existing, ...updates, id });
    if (merged.slug !== existing.slug) {
      await deleteItem(this.documentClient, this.table(), teamSlugLookupKeys(existing.slug));
      await putItem(this.documentClient, this.table(), teamSlugLookupFromDomain(merged));
    }
    await putItem(this.documentClient, this.table(), teamItemFromDomain(merged));
    return merged;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;
    await deleteItem(this.documentClient, this.table(), teamMainKeys(id));
    await deleteItem(this.documentClient, this.table(), teamSlugLookupKeys(existing.slug));
  }
}

export const teamRepository = new TeamRepository();
