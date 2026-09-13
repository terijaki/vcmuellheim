import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

/** 1×1 PNG (red pixel). */
const PNG_1X1_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const utilsPath = join(import.meta.dirname, "image-utils.ts");

function runImageUtilsUnderBun(expression: string): unknown {
  const script = `
    import {
      compressOriginal,
      generateJpegVariant,
      generateWebpVariant,
      getImageExtension,
    } from ${JSON.stringify(utilsPath)};
    const PNG_1X1 = Buffer.from(${JSON.stringify(PNG_1X1_B64)}, "base64");
    const result = ${expression};
    console.log(JSON.stringify(await result));
  `;
  const spawned = spawnSync("bun", ["-e", script], { encoding: "utf8" });
  if (spawned.status !== 0) {
    throw new Error(spawned.stderr || spawned.stdout || `bun exited ${spawned.status}`);
  }
  return JSON.parse(spawned.stdout);
}

describe("getImageExtension", () => {
  it("detects common extensions", () => {
    const script = `
      import { getImageExtension } from ${JSON.stringify(utilsPath)};
      console.log(JSON.stringify({
        jpg: getImageExtension("photo.jpg"),
        png: getImageExtension("photo.png"),
        webp: getImageExtension("photo.webp"),
        gif: getImageExtension("photo.gif"),
      }));
    `;
    const spawned = spawnSync("bun", ["-e", script], { encoding: "utf8" });
    expect(spawned.status).toBe(0);
    expect(JSON.parse(spawned.stdout)).toEqual({
      jpg: "jpg",
      png: "png",
      webp: "webp",
      gif: "gif",
    });
  });
});

describe("generateJpegVariant", () => {
  it("re-encodes a PNG as JPEG at the requested width", () => {
    const result = runImageUtilsUnderBun(`(async () => {
      const buffer = await generateJpegVariant(PNG_1X1, 64);
      return { length: buffer.length, isBuffer: Buffer.isBuffer(buffer) };
    })()`) as { length: number; isBuffer: boolean };

    expect(result.isBuffer).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("generateWebpVariant", () => {
  it("re-encodes a PNG as WebP at the requested width", () => {
    const result = runImageUtilsUnderBun(`(async () => {
      const buffer = await generateWebpVariant(PNG_1X1, 64);
      return { length: buffer.length };
    })()`) as { length: number };

    expect(result.length).toBeGreaterThan(0);
  });
});

describe("compressOriginal", () => {
  it("compresses a PNG while preserving format", () => {
    const result = runImageUtilsUnderBun(`(async () => {
      const buffer = await compressOriginal(PNG_1X1, "png");
      return { length: buffer.length };
    })()`) as { length: number };

    expect(result.length).toBeGreaterThan(0);
  });
});
