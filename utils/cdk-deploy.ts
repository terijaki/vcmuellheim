/**
 * Whether account-baseline stacks (Budget, Monitoring) should be deployed.
 *
 * These stacks are not branch-scoped: prod always gets them; dev only on shared-dev
 * (sanitized branch empty / main). Feature branches skip them.
 */
export function shouldDeployAccountOpsStacks(args: { isProd: boolean; branch: string }): boolean {
  return args.isProd || !args.branch;
}
