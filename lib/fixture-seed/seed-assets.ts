import { readFile } from "node:fs/promises";
import path from "node:path";

export const MEMBER_AVATAR_ASSETS = [
  "member-avatar-01.jpg",
  "member-avatar-02.jpg",
  "member-avatar-03.jpg",
  "member-avatar-04.jpg",
] as const;

export const SPONSOR_LOGO_ASSETS = [
  "sponsor-logo-01.jpg",
  "sponsor-logo-02.jpg",
  "sponsor-logo-03.jpg",
  "sponsor-logo-04.jpg",
] as const;

export const TEAM_PHOTO_ASSETS = ["team-photo-01.jpg", "team-photo-02.jpg"] as const;

export const NEWS_PHOTO_ASSETS = [
  "news-photo-01.jpg",
  "news-photo-02.jpg",
  "news-photo-03.jpg",
  "news-photo-04.jpg",
  "news-photo-05.jpg",
  "news-photo-06.jpg",
  "news-photo-07.jpg",
  "news-photo-08.jpg",
  "news-photo-09.jpg",
] as const;

export const INSTAGRAM_POST_ASSETS = [
  {
    full: "instagram-post-01-full.jpg",
    large: "instagram-post-01-800.jpg",
    medium: "instagram-post-01-400.jpg",
    small: "instagram-post-01-200.jpg",
  },
  {
    full: "instagram-post-02-full.jpg",
    large: "instagram-post-02-800.jpg",
    medium: "instagram-post-02-400.jpg",
    small: "instagram-post-02-200.jpg",
  },
] as const;

const ALL_KNOWN_ASSETS = [
  ...MEMBER_AVATAR_ASSETS,
  ...SPONSOR_LOGO_ASSETS,
  ...TEAM_PHOTO_ASSETS,
  ...NEWS_PHOTO_ASSETS,
  ...INSTAGRAM_POST_ASSETS.flatMap((post) => [post.full, post.large, post.medium, post.small]),
] as const;

export type SeedAssetFileName = (typeof ALL_KNOWN_ASSETS)[number];

export function fixtureSeedPublicUrl(fileName: SeedAssetFileName): string {
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/fixture-seed/${fileName}`;
}

export async function readSeedAssetBytes(fileName: SeedAssetFileName): Promise<Buffer> {
  try {
    const { useStorage } = await import("nitro/storage");
    const raw = await useStorage("assets:fixture-seed").getItemRaw(fileName);
    if (raw instanceof Uint8Array) {
      return Buffer.from(raw);
    }
    if (Buffer.isBuffer(raw)) {
      return raw;
    }
    if (typeof raw === "string") {
      return Buffer.from(raw, "binary");
    }
  } catch {
    // Local scripts/tests: read from the repo checkout.
  }

  const candidates = [
    path.join(process.cwd(), "app/public/fixture-seed", fileName),
    path.join(import.meta.dirname, "../../app/public/fixture-seed", fileName),
  ];
  let lastError: Error | undefined;
  for (const assetPath of candidates) {
    try {
      return await readFile(assetPath);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error(`Seed asset not found: ${fileName}`);
}
