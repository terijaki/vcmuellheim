/**
 * Generate WebP siblings for bundled static photos under app/public/assets.
 * Logos under app/public/assets/logos are intentionally excluded (favicons, OG, downloads).
 */
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { STATIC_BUNDLED_IMAGE_QUALITY } from "../app/src/utils/static-bundled-images";

const ROOT = join(import.meta.dirname, "../app/public/assets");
const CONVERT_DIRS = ["backgrounds", "brand", "misc"] as const;

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

async function convertFile(inputPath: string): Promise<void> {
  const outputPath = inputPath.replace(/\.(jpe?g|png)$/i, ".webp");
  const input = await Bun.file(inputPath).arrayBuffer();
  const before = (await Bun.file(inputPath).stat()).size;
  const { buffer, quality } = await pickWebpBuffer(input, before);
  await Bun.write(outputPath, buffer);
  console.log(`${inputPath.replace(ROOT + "/", "")}\t${before}\t${buffer.length}\tq${quality}`);
}

async function main() {
  console.log("path\tbytes_before\tbytes_webp\tquality");
  for (const dir of CONVERT_DIRS) {
    const fullDir = join(ROOT, dir);
    const entries = await readdir(fullDir);
    for (const name of entries) {
      if (!/\.(jpe?g|png)$/i.test(name)) continue;
      await convertFile(join(fullDir, name));
    }
  }
}

await main();
