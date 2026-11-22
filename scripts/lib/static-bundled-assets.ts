/**
 * Source files for bundled static WebP conversion (mirrors app/src/utils/static-bundled-images.ts).
 * Kept in scripts/ so the converter does not import app runtime code.
 */

export const STATIC_BUNDLED_IMAGE_QUALITY = 85;

/** Paths relative to `app/public/assets/` */
export const STATIC_BUNDLED_SOURCE_FILES = [
  "backgrounds/intro1.jpg",
  "backgrounds/intro2.jpg",
  "backgrounds/intro3.jpg",
  "backgrounds/intro4.jpg",
  "backgrounds/pageheading.jpg",
  "backgrounds/sponsors.jpg",
  "brand/jersey1.jpg",
  "brand/jersey2.jpg",
] as const;
