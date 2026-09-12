/// <reference types="bun-types" />
/**
 * Bun.Image helpers for the media image-processor Lambda.
 */

import {
  IMAGE_QUALITY,
  MAX_DECODE_PIXELS,
  MAX_ORIGINAL_SIZE,
  bytesToMB,
} from "@utils/image-config";

export type ImageExtension = "jpg" | "png" | "gif" | "webp";

export function getImageExtension(filename: string): ImageExtension {
  const extension = filename.match(/\.([^.]+)$/)?.[1]?.toLowerCase();
  if (extension === "png" || extension === "gif" || extension === "webp") {
    return extension;
  }
  return "jpg";
}

export function getContentTypeForExtension(extension: ImageExtension): string {
  switch (extension) {
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

/** Compress original to fit within MAX_ORIGINAL_SIZE, preserving format (except GIF). */
export async function compressOriginal(
  input: Uint8Array,
  extension: Exclude<ImageExtension, "gif">,
): Promise<Buffer> {
  let quality = 85;
  let lastBuffer: Buffer | undefined;

  while (quality >= 50) {
    const pipeline = new Bun.Image(input, {
      maxPixels: MAX_DECODE_PIXELS,
      autoOrient: true,
    }).resize(2400, undefined, { fit: "inside", withoutEnlargement: true });

    if (extension === "png") {
      lastBuffer = Buffer.from(await pipeline.png({ compressionLevel: 9 }).buffer());
    } else if (extension === "webp") {
      lastBuffer = Buffer.from(await pipeline.webp({ quality }).buffer());
    } else {
      lastBuffer = Buffer.from(await pipeline.jpeg({ quality }).buffer());
    }

    if (lastBuffer.length <= MAX_ORIGINAL_SIZE) {
      return lastBuffer;
    }

    if (extension === "png") {
      console.warn(
        `PNG original still exceeds limit of ${bytesToMB(MAX_ORIGINAL_SIZE, 0)}MB (${lastBuffer.length} bytes)`,
      );
      return lastBuffer;
    }

    quality -= 5;
  }

  console.warn(
    `Original image still exceeds limit of ${bytesToMB(MAX_ORIGINAL_SIZE, 0)}MB at quality 50 (${lastBuffer?.length ?? 0} bytes)`,
  );
  return lastBuffer ?? Buffer.from(input);
}

/** Generate a JPEG variant resized to the given width. */
export async function generateJpegVariant(input: Uint8Array, width: number): Promise<Buffer> {
  const pipeline = new Bun.Image(input, {
    maxPixels: MAX_DECODE_PIXELS,
    autoOrient: true,
  })
    .resize(width)
    .jpeg({ quality: IMAGE_QUALITY });

  return Buffer.from(await pipeline.buffer());
}

/** Generate a WebP variant resized to the given width. */
export async function generateWebpVariant(input: Uint8Array, width: number): Promise<Buffer> {
  const pipeline = new Bun.Image(input, {
    maxPixels: MAX_DECODE_PIXELS,
    autoOrient: true,
  })
    .resize(width)
    .webp({ quality: IMAGE_QUALITY });

  return Buffer.from(await pipeline.buffer());
}
