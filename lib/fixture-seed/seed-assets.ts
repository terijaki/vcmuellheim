import { readFile } from "node:fs/promises";
import path from "node:path";

/** Committed JPEG fixtures under `app/public/fixture-seed/` (Nitro server assets in Lambda). */
export const SEED_ASSET_FILES = {
  portrait: "portrait-400x400.jpg",
  banner: "banner-1200x800.jpg",
  logo: "logo-400x200.jpg",
  square: "square-1200x1200.jpg",
  thumb: "thumb-200x200.jpg",
  medium: "medium-800x800.jpg",
} as const;

export type SeedAssetFile = (typeof SEED_ASSET_FILES)[keyof typeof SEED_ASSET_FILES];

export function fixtureSeedPublicUrl(fileName: SeedAssetFile): string {
  const base = process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/fixture-seed/${fileName}`;
}

export async function readSeedAssetBytes(fileName: SeedAssetFile): Promise<Buffer> {
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
