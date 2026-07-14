import { execSync } from "node:child_process";

/**
 * Sanitize a branch name for use in AWS resource names and email plus-address suffixes.
 * Lowercases, replaces non-alphanumeric characters with hyphens, and truncates to 20 chars.
 */
export function sanitizeBranchName(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .substring(0, 20)
    .replace(/-+$/, "");
}

/**
 * Get current Git branch name, sanitized for AWS resource naming.
 * Returns empty string if on main branch or if Git is unavailable.
 * Sanitization: alphanumeric and hyphens only, max 20 chars.
 * @param includeMain Whether to return "main" branch name instead of empty string. Default is `false`.
 */
export function getSanitizedBranch(includeMain = false): string {
  try {
    // Allow override via environment variable (useful for production deployments from feature branches)
    const branch =
      process.env.CDK_BRANCH_OVERWRITE ||
      execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();

    // Return empty string for main branch
    if (!includeMain && branch === "main") {
      return "";
    }

    return sanitizeBranchName(branch);
  } catch {
    return "";
  }
}
