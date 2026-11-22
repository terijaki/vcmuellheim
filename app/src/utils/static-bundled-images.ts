/**
 * Bundled static images under `/assets/` (not CMS media).
 * WebP is served preferentially; JPEG/PNG originals are kept as fallbacks.
 */

export type StaticBundledImageId =
  | "backgrounds/intro1"
  | "backgrounds/intro2"
  | "backgrounds/intro3"
  | "backgrounds/intro4"
  | "backgrounds/pageheading"
  | "backgrounds/sponsors"
  | "brand/jersey1"
  | "brand/jersey2";

export type StaticBundledImageFormats = {
  webp: string;
  /** JPEG or PNG fallback kept for browsers without `image-set` / `<picture>` WebP */
  fallback: string;
};

const asset = (id: StaticBundledImageId, ext: "webp" | "jpg" | "png"): string =>
  `/assets/${id}.${ext}`;

export const STATIC_BUNDLED_IMAGES: Record<StaticBundledImageId, StaticBundledImageFormats> = {
  "backgrounds/intro1": {
    webp: asset("backgrounds/intro1", "webp"),
    fallback: asset("backgrounds/intro1", "jpg"),
  },
  "backgrounds/intro2": {
    webp: asset("backgrounds/intro2", "webp"),
    fallback: asset("backgrounds/intro2", "jpg"),
  },
  "backgrounds/intro3": {
    webp: asset("backgrounds/intro3", "webp"),
    fallback: asset("backgrounds/intro3", "jpg"),
  },
  "backgrounds/intro4": {
    webp: asset("backgrounds/intro4", "webp"),
    fallback: asset("backgrounds/intro4", "jpg"),
  },
  "backgrounds/pageheading": {
    webp: asset("backgrounds/pageheading", "webp"),
    fallback: asset("backgrounds/pageheading", "jpg"),
  },
  "backgrounds/sponsors": {
    webp: asset("backgrounds/sponsors", "webp"),
    fallback: asset("backgrounds/sponsors", "jpg"),
  },
  "brand/jersey1": {
    webp: asset("brand/jersey1", "webp"),
    fallback: asset("brand/jersey1", "jpg"),
  },
  "brand/jersey2": {
    webp: asset("brand/jersey2", "webp"),
    fallback: asset("brand/jersey2", "jpg"),
  },
};

export const HOME_INTRO_BACKGROUND_IMAGE_IDS = [
  "backgrounds/intro1",
  "backgrounds/intro2",
  "backgrounds/intro3",
  "backgrounds/intro4",
] as const satisfies readonly StaticBundledImageId[];

export type HomeIntroBackgroundImageId = (typeof HOME_INTRO_BACKGROUND_IMAGE_IDS)[number];

export function getStaticBundledImage(id: StaticBundledImageId): StaticBundledImageFormats {
  return STATIC_BUNDLED_IMAGES[id];
}

function fallbackMimeTypeForBundledAsset(fallbackPath: string): "image/jpeg" | "image/png" {
  if (fallbackPath.endsWith(".png")) {
    return "image/png";
  }
  return "image/jpeg";
}

/** Inline JPEG/PNG `background-image` plus `--static-bg-image-set` for `@supports` in globals.css. */
export function staticBundledBackgroundImageStyle(id: StaticBundledImageId): {
  backgroundImage: string;
  "--static-bg-image-set": string;
} {
  const { webp, fallback } = getStaticBundledImage(id);
  const fallbackMime = fallbackMimeTypeForBundledAsset(fallback);
  return {
    backgroundImage: `url("${fallback}")`,
    "--static-bg-image-set": `image-set(url("${webp}") type("image/webp"), url("${fallback}") type("${fallbackMime}"))`,
  };
}
