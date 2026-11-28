import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyWebappLambdaOutput } from "../../scripts/verify-webapp-lambda-output.ts";

const serverIndex = resolve("app/.output/server/index.mjs");

describe("webapp Lambda output", () => {
  it("uses a Nitro entry that imports Sentry wrapHandler at build time", async () => {
    const { readFile } = await import("node:fs/promises");
    const entrySource = await readFile("app/server/aws-lambda-sentry-entry.ts", "utf8");
    expect(entrySource).toContain("@sentry/aws-serverless");
    expect(entrySource).toContain("captureTimeoutWarning: true");
    const viteConfig = await readFile("vite.config.ts", "utf8");
    expect(viteConfig).toContain("aws-lambda-sentry-entry");
    expect(viteConfig).not.toContain("sentryLambdaRollupPlugin");
  });

  it.skipIf(!existsSync(serverIndex))(
    "imports index.mjs from an isolated copy of .output/server (Lambda asset layout)",
    async () => {
      await expect(verifyWebappLambdaOutput()).resolves.toBeUndefined();
    },
  );
});
