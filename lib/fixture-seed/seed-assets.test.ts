import { describe, expect, it } from "vite-plus/test";
import { SEED_ASSET_FILES, fixtureSeedPublicUrl, readSeedAssetBytes } from "./seed-assets";

describe("seed assets", () => {
  it("reads committed JPEG fixtures from disk", async () => {
    const buffer = await readSeedAssetBytes(SEED_ASSET_FILES.portrait);
    expect(buffer.length).toBeGreaterThan(100);
    expect(buffer[0]).toBe(0xff);
    expect(buffer[1]).toBe(0xd8);
  });

  it("builds public fixture URLs", () => {
    process.env.APP_BASE_URL = "https://dev.example.test";
    expect(fixtureSeedPublicUrl(SEED_ASSET_FILES.banner)).toBe(
      "https://dev.example.test/fixture-seed/banner-1200x800.jpg",
    );
  });
});
