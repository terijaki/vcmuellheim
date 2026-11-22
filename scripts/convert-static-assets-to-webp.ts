/**
 * Generate WebP siblings for bundled static photos listed in scripts/lib/static-bundled-assets.ts.
 * Logos under app/public/assets/logos are intentionally excluded (favicons, OG, downloads).
 */
import { join } from "node:path";
import {
  STATIC_BUNDLED_IMAGE_QUALITY,
  STATIC_BUNDLED_SOURCE_FILES,
} from "./lib/static-bundled-assets";

const ASSETS_ROOT = join(import.meta.dirname, "../app/public/assets");

async function encodeWebp(input: ArrayBuffer, quality: number): Promise<Buffer> {
  return Buffer.from(await new Bun.Image(input).webp({ quality }).buffer());
}

/** Prefer the highest quality that is still smaller than the source; otherwise use the smallest trial. */
async function pickWebpBuffer(
  input: ArrayBuffer,
  originalBytes: number,
): Promise<{ buffer: Buffer; quality: number }> {
  const qualities = [STATIC_BUNDLED_IMAGE_QUALITY, 80, 75, 70] as const;
  let fallback: { buffer: Buffer; quality: number } | null = null;

  for (const quality of qualities) {
    const buffer = await encodeWebp(input, quality);
    if (!fallback || buffer.length < fallback.buffer.length) {
      fallback = { buffer, quality };
    }
    if (buffer.length < originalBytes) {
      return { buffer, quality };
    }
  }

  return fallback!;
}

async function convertFile(relativePath: string): Promise<void> {
  const inputPath = join(ASSETS_ROOT, relativePath);
  const outputPath = inputPath.replace(/\.(jpe?g|png)$/i, ".webp");
  const input = await Bun.file(inputPath).arrayBuffer();
  const before = (await Bun.file(inputPath).stat()).size;
  const { buffer, quality } = await pickWebpBuffer(input, before);
  await Bun.write(outputPath, buffer);
  console.log(`${relativePath}\t${before}\t${buffer.length}\tq${quality}`);
}

async function main() {
  console.log("path\tbytes_before\tbytes_webp\tquality");
  for (const relativePath of STATIC_BUNDLED_SOURCE_FILES) {
    await convertFile(relativePath);
  }
}

await main();
