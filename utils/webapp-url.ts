import { Club } from "../project.config.ts";

/**
 * Single source of truth for computing the webapp hostname.
 * Used by CDK stacks, the Vite dev plugin, and server-side runtime code.
 *
 * Domain scheme:
 *   prod               → vcmuellheim.de
 *   dev (main branch)  → dev.new.vcmuellheim.de
 *   dev (feature)      → dev-<branch>.new.vcmuellheim.de
 *
 * @param environment - CDK environment ("dev" | "prod")
 * @param branch      - Sanitized branch name (empty string for main branch)
 */
export function buildWebappDomain(environment: string, branch: string): string {
	if (environment === "prod") return Club.domain;
	const branchSuffix = branch ? `-${branch}` : "";
	return `${environment}${branchSuffix}.new.${Club.domain}`;
}

export function buildWebappUrl(environment: string, branch: string): string {
	return `https://${buildWebappDomain(environment, branch)}`;
}
