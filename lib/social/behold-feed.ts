/**
 * Shared Behold Instagram feed storage: DynamoDB keys, item schema, and repository.
 */

import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { BeholdPostSchema, type BeholdPost } from "@/lambda/social/types";
import { docClient } from "@/lib/db/client";
import { getSocialTableName } from "@/lib/db/env";

export const BEHOLD_FEED_PK = "social#behold";
export const BEHOLD_FEED_SK = "feed";

export const beholdFeedItemSchema = z.object({
  pk: z.literal(BEHOLD_FEED_PK),
  sk: z.literal(BEHOLD_FEED_SK),
  data: z.string().min(1),
  cachedAt: z.iso.datetime(),
  ttl: z.number().int().positive(),
});

export type BeholdFeedItem = z.infer<typeof beholdFeedItemSchema>;

const beholdPostsSchema = z.array(BeholdPostSchema);

export class BeholdFeedRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private resolveTableName(): string {
    return this.tableName ?? getSocialTableName();
  }

  async readPosts(): Promise<BeholdPost[]> {
    const result = await this.documentClient.send(
      new GetCommand({
        TableName: this.resolveTableName(),
        Key: { pk: BEHOLD_FEED_PK, sk: BEHOLD_FEED_SK },
      }),
    );
    if (!result.Item) return [];

    const item = beholdFeedItemSchema.safeParse(result.Item);
    if (!item.success) return [];

    try {
      const parsed = beholdPostsSchema.safeParse(JSON.parse(item.data.data));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }

  async writePosts(posts: BeholdPost[], ttlSeconds: number, nowMs = Date.now()): Promise<void> {
    const item: BeholdFeedItem = {
      pk: BEHOLD_FEED_PK,
      sk: BEHOLD_FEED_SK,
      data: JSON.stringify(posts),
      cachedAt: new Date(nowMs).toISOString(),
      ttl: Math.floor(nowMs / 1000) + ttlSeconds,
    };
    await this.documentClient.send(
      new PutCommand({
        TableName: this.resolveTableName(),
        Item: beholdFeedItemSchema.parse(item),
      }),
    );
  }
}

export function createBeholdFeedRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): BeholdFeedRepository {
  return new BeholdFeedRepository(client, tableName);
}

export const beholdFeedRepository = new BeholdFeedRepository();
