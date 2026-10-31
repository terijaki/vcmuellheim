import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import {
  newsItemFromDomain,
  newsMainKeys,
  newsSlugLookupFromDomain,
  newsSlugLookupKeys,
} from "@/lib/db/content-keys";
import { getContentTableName } from "@/lib/db/env";
import { newsSchema, type NewsInput } from "@/lib/db/schemas";
import type { News, PaginationCursor } from "@/lib/db/types";
import {
  deleteItem,
  getItem,
  parseDomain,
  putItem,
  queryGsi1,
} from "@/lib/db/repositories/dynamo-helpers";

const NEWS_STATUSES = ["draft", "published", "archived"] as const;

type NewsMergeCursor = Partial<Record<(typeof NEWS_STATUSES)[number], string>>;

function encodeMergeCursor(state: NewsMergeCursor): string | undefined {
  if (Object.keys(state).length === 0) return undefined;
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64");
}

function decodeMergeCursor(cursor?: PaginationCursor): NewsMergeCursor {
  if (!cursor) return {};
  const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid news merge cursor");
  }
  return parsed as NewsMergeCursor;
}

export class NewsRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table(): string {
    return this.tableName ?? getContentTableName();
  }

  async getById(id: string): Promise<News | null> {
    const item = await getItem(this.documentClient, this.table(), newsMainKeys(id));
    return item ? parseDomain(newsSchema, item, "Failed to parse news") : null;
  }

  async getBySlug(slug: string): Promise<News | null> {
    const lookup = await getItem(this.documentClient, this.table(), newsSlugLookupKeys(slug));
    if (!lookup || typeof lookup.id !== "string") return null;
    return this.getById(lookup.id);
  }

  async create(news: News): Promise<News> {
    const parsed = newsSchema.parse(news);
    await putItem(this.documentClient, this.table(), newsItemFromDomain(parsed));
    await putItem(this.documentClient, this.table(), newsSlugLookupFromDomain(parsed));
    return parsed;
  }

  async put(news: News): Promise<News> {
    return this.create(news);
  }

  async update(id: string, updates: Partial<News>): Promise<News | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = newsSchema.parse({ ...existing, ...updates, id });
    if (merged.slug !== existing.slug) {
      await deleteItem(this.documentClient, this.table(), newsSlugLookupKeys(existing.slug));
      await putItem(this.documentClient, this.table(), newsSlugLookupFromDomain(merged));
    }
    if (merged.status !== existing.status) {
      await putItem(this.documentClient, this.table(), newsItemFromDomain(merged));
    } else {
      await putItem(this.documentClient, this.table(), newsItemFromDomain(merged));
    }
    return merged;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;
    await deleteItem(this.documentClient, this.table(), newsMainKeys(id));
    await deleteItem(this.documentClient, this.table(), newsSlugLookupKeys(existing.slug));
  }

  async listByStatus(
    status: News["status"],
    limit: number,
    cursor?: PaginationCursor,
  ): Promise<{ items: News[]; cursor?: PaginationCursor }> {
    const page = await queryGsi1(this.documentClient, this.table(), {
      gsi1pk: `news#${status}`,
      scanIndexForward: false,
      limit,
      cursor,
    });
    return {
      items: page.items.map((item) => parseDomain(newsSchema, item, "Failed to parse news")),
      cursor: page.cursor,
    };
  }

  private async listOneByStatus(
    status: News["status"],
    cursor?: string,
  ): Promise<{ item?: News; cursor?: string }> {
    const page = await this.listByStatus(status, 1, cursor);
    return { item: page.items[0], cursor: page.cursor };
  }

  async listPublished(
    limit: number,
    cursor?: PaginationCursor,
  ): Promise<{ items: News[]; lastEvaluatedKey?: PaginationCursor }> {
    const page = await this.listByStatus("published", limit, cursor);
    return { items: page.items, lastEvaluatedKey: page.cursor };
  }

  async listAllMerged(
    limit: number,
    cursor?: PaginationCursor,
  ): Promise<{ items: News[]; lastEvaluatedKey?: PaginationCursor }> {
    const state = decodeMergeCursor(cursor);
    const collected: News[] = [];
    const nextState: NewsMergeCursor = { ...state };
    const exhausted = new Set<(typeof NEWS_STATUSES)[number]>();

    while (collected.length < limit) {
      const candidates: Array<{
        news: News;
        status: (typeof NEWS_STATUSES)[number];
        cursor?: string;
      }> = [];
      for (const status of NEWS_STATUSES) {
        if (exhausted.has(status)) continue;
        const page = await this.listOneByStatus(status, nextState[status]);
        if (page.item) {
          candidates.push({ news: page.item, status, cursor: page.cursor });
        } else {
          exhausted.add(status);
        }
      }
      if (candidates.length === 0) break;

      candidates.sort((a, b) => b.news.createdAt.localeCompare(a.news.createdAt));
      const winner = candidates[0];
      collected.push(winner.news);
      if (winner.cursor) {
        nextState[winner.status] = winner.cursor;
      } else {
        exhausted.add(winner.status);
        delete nextState[winner.status];
      }
    }

    return {
      items: collected,
      lastEvaluatedKey: encodeMergeCursor(nextState),
    };
  }
}

export const newsRepository = new NewsRepository();

export function createNewsRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): NewsRepository {
  return new NewsRepository(client, tableName);
}

export type { NewsInput };
