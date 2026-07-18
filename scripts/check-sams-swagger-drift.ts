#!/usr/bin/env bun
/**
 * Compares committed vs regenerated SAMS swagger source.json with key-order-insensitive equality.
 *
 * Usage:
 *   bun scripts/check-sams-swagger-drift.ts <committed.json> <regenerated.json>
 *
 * Prints JSON: { hasDrift, changeCount, summaryMarkdown }
 * Exits 0 when the check completes (drift or not).
 * Exits 1 on usage errors or invalid JSON.
 *
 * Used by .github/workflows/sams-health-check.yml
 */

import { readFileSync } from "node:fs";
import { compareSwaggerSnapshots, formatDriftSummaryMarkdown } from "./sams-swagger-drift";

const committedPath = process.argv[2];
const regeneratedPath = process.argv[3];

if (!committedPath || !regeneratedPath) {
  console.error(
    "Usage: bun scripts/check-sams-swagger-drift.ts <committed.json> <regenerated.json>",
  );
  process.exit(1);
}

let committedJson: string;
let regeneratedJson: string;
try {
  committedJson = readFileSync(committedPath, "utf8");
  regeneratedJson = readFileSync(regeneratedPath, "utf8");
} catch (error) {
  console.error(`Failed to read swagger snapshot files: ${String(error)}`);
  process.exit(1);
}

let result: ReturnType<typeof compareSwaggerSnapshots>;
try {
  result = compareSwaggerSnapshots(committedJson, regeneratedJson);
} catch (error) {
  console.error(`Failed to parse swagger JSON: ${String(error)}`);
  process.exit(1);
}

const output = {
  hasDrift: result.hasDrift,
  changeCount: result.changes.length,
  summaryMarkdown: formatDriftSummaryMarkdown(result.changes),
};

console.log(JSON.stringify(output));
process.exit(0);
