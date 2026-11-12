import dayjs from "dayjs";
import { BeholdPostSchema, type BeholdPost } from "@/lambda/social/types";
import { createBeholdFeedRepository } from "@/lib/social/behold-feed";
import type { SeedContext } from "./common";
import { SEED_ASSET_FILES, fixtureSeedPublicUrl } from "./seed-assets";

/** Match behold-sync retention: keep at most 2 recent posts in the feed cache. */
const MAX_SEED_POSTS = 2;
/** Match behold-sync DDB hygiene TTL (90 days). */
const DDB_TTL_SECONDS = 90 * 24 * 60 * 60;

const DEFAULT_COLOR_PALETTE = {
  dominant: "#366273",
  muted: "#5a7a85",
  mutedLight: "#8aa4ad",
  mutedDark: "#2a4a55",
  vibrant: "#01a29a",
  vibrantLight: "#4ec4be",
  vibrantDark: "#017a74",
} as const;

function fixtureSeedSizes() {
  return {
    small: {
      mediaUrl: fixtureSeedPublicUrl(SEED_ASSET_FILES.thumb),
      height: 200,
      width: 200,
    },
    medium: {
      mediaUrl: fixtureSeedPublicUrl(SEED_ASSET_FILES.portrait),
      height: 400,
      width: 400,
    },
    large: {
      mediaUrl: fixtureSeedPublicUrl(SEED_ASSET_FILES.medium),
      height: 800,
      width: 800,
    },
    full: {
      mediaUrl: fixtureSeedPublicUrl(SEED_ASSET_FILES.square),
      height: 1200,
      width: 1200,
    },
  };
}

function buildSeedPosts(): BeholdPost[] {
  const posts = [
    {
      id: "seed-instagram-1",
      timestamp: dayjs().subtract(2, "days").toISOString(),
      permalink: "https://www.instagram.com/p/seed-matchday/",
      mediaType: "IMAGE" as const,
      mediaUrl: fixtureSeedPublicUrl(SEED_ASSET_FILES.square),
      sizes: fixtureSeedSizes(),
      caption: "Matchday vibes! 🏐 #vcmüllheim #volleyball",
      prunedCaption: "Matchday vibes!",
      hashtags: ["vcmüllheim", "volleyball"],
      mentions: [],
      colorPalette: DEFAULT_COLOR_PALETTE,
    },
    {
      id: "seed-instagram-2",
      timestamp: dayjs().subtract(5, "days").toISOString(),
      permalink: "https://www.instagram.com/p/seed-training/",
      mediaType: "IMAGE" as const,
      mediaUrl: fixtureSeedPublicUrl(SEED_ASSET_FILES.square),
      sizes: fixtureSeedSizes(),
      caption: "Trainingseinheit der Jugend 💪 #jugend #vcmuellheim",
      prunedCaption: "Trainingseinheit der Jugend",
      hashtags: ["jugend", "vcmuellheim"],
      mentions: [],
      colorPalette: DEFAULT_COLOR_PALETTE,
    },
  ].slice(0, MAX_SEED_POSTS);

  return posts.map((post) => BeholdPostSchema.parse(post));
}

export async function seedInstagramData(ctx: SeedContext): Promise<void> {
  console.log("\n📸 Seeding Instagram posts...");

  if (!ctx.socialTableName) {
    throw new Error("socialTableName is required to seed Instagram posts");
  }

  const posts = buildSeedPosts();
  const feedRepository = createBeholdFeedRepository(ctx.docClient, ctx.socialTableName);
  await feedRepository.writePosts(posts, DDB_TTL_SECONDS);
  console.log(`✅ Seeded ${posts.length} Instagram posts`);
}
