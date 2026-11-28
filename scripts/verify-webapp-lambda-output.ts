import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const serverDir = resolve("app/.output/server");

export async function verifyWebappLambdaOutput(rootDir = process.cwd()): Promise<void> {
  const dir = resolve(rootDir, "app/.output/server");

  const isolated = mkdtempSync(join(tmpdir(), "vcm-webapp-lambda-"));
  try {
    cpSync(dir, isolated, { recursive: true });
    // Lambda provides `awslambda` at runtime; stub it so the entry module can load in verification.
    (globalThis as { awslambda?: { streamifyResponse: <T>(fn: T) => T } }).awslambda = {
      streamifyResponse: (fn) => fn,
    };
    const mod = await import(`file://${join(isolated, "index.mjs")}`);
    if (typeof mod.handler !== "function") {
      throw new Error("index.mjs does not export a handler function");
    }
  } finally {
    rmSync(isolated, { recursive: true, force: true });
  }

  return Promise.resolve();
}

if (import.meta.main) {
  await verifyWebappLambdaOutput();
  console.log(`OK: ${serverDir}/index.mjs exports handler and imports in isolation`);
}
