/**
 * Social media server-only helpers — cached Behold Instagram posts from DynamoDB.
 */

import type { BeholdPost } from "@/lambda/social/types";
import { beholdFeedRepository } from "@/lib/social/behold-feed";

export async function handleGetInstagramPosts(): Promise<BeholdPost[]> {
  try {
    return await beholdFeedRepository.readPosts();
  } catch {
    return [];
  }
}
