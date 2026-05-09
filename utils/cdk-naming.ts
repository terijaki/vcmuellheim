/**
 * Builds a CDK stack name and environment label from the deployment context.
 *
 * - Prod stacks have no branch suffix: `<Base>-Prod`
 * - Dev stacks always carry a branch identifier: `<Base>-Dev-<branch>`
 *   (defaults to `main` when on the default branch)
 *
 * @param isProd - Whether the deployment targets production.
 * @param branch - Sanitized branch name (empty string for `main`).
 */
export function getCdkNaming(
  isProd: true,
  branch: string,
): {
  stackName: <T extends string>(base: T) => `${T}-Prod`;
  envLabel: "prod";
};
export function getCdkNaming(
  isProd: false,
  branch: string,
): {
  stackName: <T extends string>(base: T) => `${T}-Dev-${string}`;
  envLabel: `dev-${string}`;
};
export function getCdkNaming(
  isProd: boolean,
  branch: string,
): {
  stackName: <T extends string>(base: T) => `${T}-Prod` | `${T}-Dev-${string}`;
  envLabel: "prod" | `dev-${string}`;
};
export function getCdkNaming(isProd: boolean, branch: string) {
  if (isProd) {
    return {
      stackName: <T extends string>(base: T) => `${base}-Prod` as `${T}-Prod`,
      envLabel: "prod" as const,
    };
  }
  const devBranchSuffix = `-${branch || "main"}` as `-${string}`;
  return {
    stackName: <T extends string>(base: T) =>
      `${base}-Dev${devBranchSuffix}` as `${T}-Dev-${string}`,
    envLabel: `dev${devBranchSuffix}` as `dev-${string}`,
  };
}
