import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUN_LINUX_X64_RELEASE_URL, BUN_VERSION } from "@utils/buntime";

const runtimeDir = __dirname;

function findBunBinary(root: string): string | undefined {
  const entries = readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(root, entry.name);
    if (entry.isFile() && entry.name === "bun") return fullPath;
    if (!entry.isDirectory()) continue;
    const nested = findBunBinary(fullPath);
    if (nested) return nested;
  }
  return undefined;
}

export async function bundleBunTimeLayer(outputDir: string): Promise<void> {
  mkdirSync(outputDir, { recursive: true });
  const downloadDir = mkdtempSync(join(tmpdir(), "buntime-"));
  try {
    const zipPath = join(downloadDir, "bun.zip");
    const response = await fetch(BUN_LINUX_X64_RELEASE_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to download Bun ${BUN_VERSION}: ${response.status} ${response.statusText}`,
      );
    }
    writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));

    const unzip = spawnSync(
      "python3",
      ["-c", `import zipfile; zipfile.ZipFile(r"${zipPath}").extractall(r"${downloadDir}")`],
      { stdio: "inherit" },
    );
    if (unzip.status !== 0) {
      throw new Error(`Failed to unzip Bun ${BUN_VERSION} (exit ${unzip.status})`);
    }

    const bunBinary = findBunBinary(downloadDir);
    if (!bunBinary) {
      throw new Error(`Did not find a bun binary in the ${BUN_VERSION} Linux x64 zip`);
    }
    copyFileSync(bunBinary, join(outputDir, "bun"));
    chmodSync(join(outputDir, "bun"), 0o755);

    const build = spawnSync(
      "bun",
      [
        "build",
        join(runtimeDir, "runtime.ts"),
        "--outfile",
        join(outputDir, "runtime.js"),
        "--target=bun",
      ],
      { stdio: "inherit" },
    );
    if (build.status !== 0) {
      throw new Error(`Failed to bundle Bun Lambda runtime (exit ${build.status})`);
    }

    copyFileSync(join(runtimeDir, "bootstrap"), join(outputDir, "bootstrap"));
    chmodSync(join(outputDir, "bootstrap"), 0o755);
    writeFileSync(join(outputDir, "VERSION"), `${BUN_VERSION}\n`);
  } finally {
    rmSync(downloadDir, { recursive: true, force: true });
  }
}

const outputDir = process.argv[2];
if (process.argv[1]?.includes("bundle-layer")) {
  if (!outputDir) {
    throw new Error("Usage: bun bundle-layer.ts <outputDir>");
  }
  bundleBunTimeLayer(outputDir).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
