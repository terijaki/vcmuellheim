import { isAllowedMediaS3Key } from "@/lib/media/image-processing";
import type { News } from "@/lib/db/types";
import { handleGetFileUrls } from "./functions/upload.server";
import { withNewsPublicUrl } from "./news-public-url";

export const NEWS_GALLERY_S3_PREFIX = "news/";

/** Raster and SVG types accepted by the admin news dropzone. */
export const CMS_NEWS_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

export type CmsNewsImageContentType = (typeof CMS_NEWS_IMAGE_CONTENT_TYPES)[number];

export function isCmsNewsImageContentType(value: string): value is CmsNewsImageContentType {
  return (CMS_NEWS_IMAGE_CONTENT_TYPES as readonly string[]).includes(value);
}

export function validateNewsGalleryS3Keys(keys: string[]): string | null {
  for (const key of keys) {
    if (!key.startsWith(NEWS_GALLERY_S3_PREFIX)) {
      return "Each imageS3Key must be under the news/ prefix";
    }
    if (!isAllowedMediaS3Key(key)) {
      return "Invalid imageS3Key";
    }
  }
  return null;
}

export type AdminNewsArticleResponse = ReturnType<typeof withNewsPublicUrl> & {
  imageUrls: string[];
};

export async function toAdminNewsArticleResponse(
  origin: string,
  article: News,
): Promise<AdminNewsArticleResponse> {
  const withUrl = withNewsPublicUrl(origin, article);
  const keys = article.imageS3Keys ?? [];
  const imageUrls = keys.length > 0 ? await handleGetFileUrls(keys) : [];
  return { ...withUrl, imageUrls };
}
