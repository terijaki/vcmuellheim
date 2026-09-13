import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  BUN_DOCKER_IMAGE,
  BUN_LINUX_X64_RELEASE_URL,
  BUN_TIME_LAYER_SSM_NAME,
  BUN_VERSION,
} from "./buntime";

const repoRoot = join(import.meta.dirname, "..");

describe("Bun 1.4 pins", () => {
  it("keeps runtime constant and packageManager on the same version", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      packageManager: string;
      devDependencies: Record<string, string>;
    };

    expect(BUN_VERSION).toBe("1.4.0");
    expect(packageJson.packageManager).toBe(`bun@${BUN_VERSION}`);
    expect(packageJson.devDependencies["bun-types"]).toBe(BUN_VERSION);
  });

  it("points the layer download, Docker image, and SSM name at the pinned runtime", () => {
    expect(BUN_DOCKER_IMAGE).toBe(`oven/bun:${BUN_VERSION}`);
    expect(BUN_LINUX_X64_RELEASE_URL).toBe(
      `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip`,
    );
    expect(BUN_TIME_LAYER_SSM_NAME).toBe("/vcmuellheim/lambda/buntime-arn");
  });
});
