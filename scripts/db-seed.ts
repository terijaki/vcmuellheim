#!/usr/bin/env bun

/**
 * Ask a deployed feature-branch webapp to reset and seed its content table.
 * Prod and branch-less deployments do not expose the route.
 *
 * CI sets CDK_BRANCH_OVERWRITE to the git ref (same value used at deploy)
 * and runs this after CDK deploy. When CDK_BUDGET_ALERT_EMAIL is set (via
 * Varlock / SSM), that address is granted CMS Admin after fixtures seed.
 *
 * Usage: bun run db:seed
 */

import "varlock/auto-load";
import { getSanitizedBranch } from "@/utils/git";
import { featureBranchSeedToken } from "@/utils/seed-access";
import { buildWebappUrl } from "@/utils/webapp-url";

const branch = getSanitizedBranch();
if (!branch) {
  console.error("Content seed runs only against a feature-branch deployment.");
  process.exit(1);
}

if (process.env.CDK_ENVIRONMENT === "prod") {
  console.error("Cannot seed production.");
  process.exit(1);
}

const url = `${buildWebappUrl("dev", branch)}/api/dev/seed`;
const token = featureBranchSeedToken(branch);
const adminEmail = process.env.CDK_BUDGET_ALERT_EMAIL?.trim();

console.log(`Seeding ${url}`);
if (adminEmail) {
  console.log(`CMS admin email: ${adminEmail}`);
}

const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    ...(adminEmail ? { "Content-Type": "application/json" } : {}),
  },
  body: adminEmail ? JSON.stringify({ adminEmail }) : undefined,
  signal: AbortSignal.timeout(90_000),
});
const body = await response.text();
if (!response.ok) {
  console.error(`Seed failed (${response.status}): ${body}`);
  process.exit(1);
}

console.log(body.trim() || "Database seeding completed successfully");
