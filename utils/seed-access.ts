import { createHash, timingSafeEqual } from "node:crypto";

/** SHA-256 hex of the sanitized branch name already stored in BRANCH_NAME. */
export function featureBranchSeedToken(branchName: string): string {
  return createHash("sha256").update(branchName).digest("hex");
}

export function seedTokenMatches(branchName: string, presented: string): boolean {
  const expected = Buffer.from(featureBranchSeedToken(branchName));
  const actual = Buffer.from(presented);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export type SeedAccess = { ok: true } | { ok: false; status: 401 | 404 };

/**
 * Prod and deployments without a branch name do not expose seeding.
 * Feature branches require the deterministic bearer token.
 */
export function authorizeFeatureBranchSeed(input: {
  environment: string | undefined;
  branchName: string | undefined;
  authorizationHeader: string | null;
}): SeedAccess {
  if (input.environment === "prod" || !input.branchName) {
    return { ok: false, status: 404 };
  }
  const header = input.authorizationHeader ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!seedTokenMatches(input.branchName, token)) {
    return { ok: false, status: 401 };
  }
  return { ok: true };
}
