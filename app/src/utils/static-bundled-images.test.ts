import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getStaticBundledImage,
  HOME_INTRO_BACKGROUND_IMAGE_IDS,
  STATIC_BUNDLED_IMAGES,
  staticBundledBackgroundImageStyle,
  type StaticBundledImageId,
} from "./static-bundled-images";

const PUBLIC_ASSETS_ROOT = join(import.meta.dirname, "../../public/assets");

function publicAssetPath(urlPath: string): string {
  return join(PUBLIC_ASSETS_ROOT, urlPath.replace(/^\/assets\//, ""));
}

describe("static-bundled-images", () => {
  it("maps every intro id to webp and jpeg paths", () => {
    for (const id of HOME_INTRO_BACKGROUND_IMAGE_IDS) {
      const { webp, fallback } = getStaticBundledImage(id);
      expect(webp).toMatch(/\.webp$/);
      expect(fallback).toMatch(/\.jpg$/);
    }
  });

  it("sets literal fallback background and image-set custom property", () => {
    const style = staticBundledBackgroundImageStyle("backgrounds/pageheading");
    expect(style.backgroundImage).toBe('url("/assets/backgrounds/pageheading.jpg")');
    expect(style["--static-bg-image-set"]).toContain('type("image/webp")');
    expect(style["--static-bg-image-set"]).toContain('type("image/jpeg")');
    expect(style["--static-bg-image-set"]).toContain("pageheading.webp");
  });

  it("has webp and fallback files on disk for every registry entry", () => {
    for (const id of Object.keys(STATIC_BUNDLED_IMAGES) as StaticBundledImageId[]) {
      const { webp, fallback } = getStaticBundledImage(id);
      expect(existsSync(publicAssetPath(webp)), `missing ${webp}`).toBe(true);
      expect(existsSync(publicAssetPath(fallback)), `missing ${fallback}`).toBe(true);
    }
  });
});
