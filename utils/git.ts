import { execSync } from "node:child_process";

/**
 * Get current Git branch name, sanitized for AWS resource naming.
 * Returns empty string if on main branch or if Git is unavailable.
 * Sanitization: alphanumeric and hyphens only, max 20 chars.
 * @param includeMain Whether to return "main" branch name instead of empty string. Default is `false`.
 */
export function getSanitizedBranch(includeMain = false): string {
	try {
		// Allow override via environment variable (useful for production deployments from feature branches)
		const branch = process.env.CDK_BRANCH_OVERWRITE || execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();

		// Return empty string for main branch
		if (!includeMain && branch === "main") {
			return "";
		}

		// Sanitize: alphanumeric and hyphens only, max 20 chars
		return branch
			.replace(/[^a-zA-Z0-9-]/g, "-")
			.replace(/--+/g, "-")
			.substring(0, 20);
	} catch {
		return "";
	}
}
