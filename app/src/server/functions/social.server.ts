/**
 * Social media server-only helpers — cached Behold Instagram posts from DynamoDB.
 */

import type { BeholdPost } from "@/lambda/social/types";
import { createCacheKey } from "@utils/cache";
import { readCacheEntry } from "../ddb-cache";

/** Cache key must match the one used by lambda/social/behold-sync.ts */
const BEHOLD_CACHE_KEY = createCacheKey({ type: "behold_feed" });

export async function handleGetInstagramPosts(): Promise<BeholdPost[]> {
  try {
    const cached = await readCacheEntry<BeholdPost[]>(BEHOLD_CACHE_KEY, Infinity);
    return cached ?? [];
  } catch {
    return [];
  }
}
