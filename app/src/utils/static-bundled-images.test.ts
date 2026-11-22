import { describe, expect, it } from "vitest";
import {
  getStaticBundledImage,
  HOME_INTRO_BACKGROUND_IMAGE_IDS,
  staticBundledBackgroundImageStyle,
} from "./static-bundled-images";

describe("static-bundled-images", () => {
  it("maps every intro id to webp and jpeg paths", () => {
    for (const id of HOME_INTRO_BACKGROUND_IMAGE_IDS) {
      const { webp, fallback } = getStaticBundledImage(id);
      expect(webp).toMatch(/\.webp$/);
      expect(fallback).toMatch(/\.jpg$/);
    }
  });

  it("builds image-set CSS variables", () => {
    const style = staticBundledBackgroundImageStyle("backgrounds/pageheading");
    expect(style["--static-bg-fallback"]).toContain("pageheading.jpg");
    expect(style["--static-bg-set"]).toContain("image/webp");
    expect(style["--static-bg-set"]).toContain("pageheading.webp");
  });
});
