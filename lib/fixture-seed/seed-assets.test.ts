import { describe, expect, it } from "vite-plus/test";
import {
  MEMBER_AVATAR_ASSETS,
  NEWS_PHOTO_ASSETS,
  fixtureSeedPublicUrl,
  readSeedAssetBytes,
} from "./seed-assets";

describe("seed assets", () => {
  it("reads committed JPEG fixtures from disk", async () => {
    const buffer = await readSeedAssetBytes(MEMBER_AVATAR_ASSETS[0]);
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer[0]).toBe(0xff);
    expect(buffer[1]).toBe(0xd8);
  });

  it("expects one unique asset per news photo slot", () => {
    const usedInSeed = [2, 1, 3, 0, 1, 2].reduce((sum, count) => sum + count, 0);
    expect(NEWS_PHOTO_ASSETS.length).toBeGreaterThanOrEqual(usedInSeed);
    expect(new Set(NEWS_PHOTO_ASSETS).size).toBe(NEWS_PHOTO_ASSETS.length);
  });

  it("builds public fixture URLs", () => {
    process.env.APP_BASE_URL = "https://dev.example.test";
    expect(fixtureSeedPublicUrl(MEMBER_AVATAR_ASSETS[0])).toBe(
      "https://dev.example.test/fixture-seed/member-avatar-01.jpg",
    );
  });
});
