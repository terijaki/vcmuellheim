/**
 * Social media server-only helpers — cached Behold Instagram posts from DynamoDB.
 */

import type { BeholdPost } from "@/lambda/social/types";
import { readBeholdFeed } from "../social-feed";

export async function handleGetInstagramPosts(): Promise<BeholdPost[]> {
  try {
    return await readBeholdFeed();
  } catch {
    return [];
  }
}
