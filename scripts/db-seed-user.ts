#!/usr/bin/env bun

/**
 * Grant CMS Admin (email OTP login) to a member by private email.
 * Creates a minimal member when none exists. Dev / feature-branch only.
 *
 * Usage:
 *   vpr db:seed:user you@example.com
 */

import "varlock/auto-load";
import { execSync } from "node:child_process";
import { grantCmsAdmin } from "@/lib/fixture-seed/cms-admin";
import { getSanitizedBranch } from "@/utils/git";

function checkAwsSession(): void {
  try {
    execSync("aws sts get-caller-identity", { stdio: "ignore" });
  } catch {
    console.error(
      "❌ No active AWS session found. Authenticate via AWS SSO before running this script. See docs/SETUP.md.",
    );
    process.exit(1);
  }
}

const emailArg = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!emailArg) {
  console.error("❌ Email required. Usage: vpr db:seed:user you@example.com");
  process.exit(1);
}

const cdkEnvironment = process.env.CDK_ENVIRONMENT || "dev";
if (cdkEnvironment === "prod") {
  console.error("❌ Cannot seed CMS users in production.");
  process.exit(1);
}

checkAwsSession();

const branch = getSanitizedBranch();
console.log(`👤 Seeding CMS admin on branch ${branch || "default"}…`);

try {
  const result = await grantCmsAdmin(null, emailArg);
  if (result.status === "created") {
    console.log(`✅ Created member ${result.email} with Admin role`);
  } else if (result.status === "updated") {
    console.log(`✅ Granted Admin role to existing member ${result.email}`);
  } else {
    console.log(`ℹ️  Member ${result.email} already has authRole: ${result.authRole}`);
  }
  console.log("   Sign in at the CMS with email OTP (passwordless).");
} catch (error) {
  console.error("❌ Failed to seed CMS user:", error);
  process.exit(1);
}
