#!/usr/bin/env bun

/**
 * Rebuild homepage read documents from the current content and SAMS rows.
 * Does not rewrite source items. Safe to run more than once.
 *
 * Usage: bun run db:rebuild-public-reads
 */

import "varlock/auto-load";
import { docClient } from "@/lib/db/client";
import { getSamsTableName } from "@/lib/db/env";
import { rebuildAllPublicSnapshots } from "@/lib/read-models/public-snapshots";
import { rebuildAppProjections } from "@/lib/sams/app-projections/rebuild-app-projections";
import { createSamsRepositories } from "@/lib/sams/repositories";

async function main() {
  console.log("Rebuilding public content snapshots...");
  await rebuildAllPublicSnapshots();
  console.log("Rebuilding SAMS application projections, including Heimspiele cards...");
  const result = await rebuildAppProjections(createSamsRepositories(docClient, getSamsTableName()));
  console.log("Done.", result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
