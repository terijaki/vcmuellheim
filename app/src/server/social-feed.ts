/**
 * DynamoDB-backed Behold Instagram feed reader.
 *
 * Key scheme (social table):
 *   PK: `social#behold`
 *   SK: `feed`
 */

import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { BeholdPost } from "@/lambda/social/types";
import { docClient } from "@/lib/db/client";
import { getSocialTableName } from "@/lib/db/env";

export const BEHOLD_FEED_PK = "social#behold";
export const BEHOLD_FEED_SK = "feed";

type BeholdFeedEntry = {
  pk: string;
  sk: string;
  data: string;
  cachedAt: string;
  ttl: number;
};

export async function readBeholdFeed(): Promise<BeholdPost[]> {
  const result = await docClient.send(
    new GetCommand({
      TableName: getSocialTableName(),
      Key: { pk: BEHOLD_FEED_PK, sk: BEHOLD_FEED_SK },
    }),
  );

  if (!result.Item) return [];

  const entry = result.Item as BeholdFeedEntry;

  try {
    return JSON.parse(entry.data) as BeholdPost[];
  } catch {
    return [];
  }
}
