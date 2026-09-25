import { getSanitizedBranch } from "./git";

function branchSuffix(): string {
  const branch = getSanitizedBranch();
  return branch ? `-${branch}` : "";
}

export function buildLambdaFunctionName(baseName: string): string {
  const environment = process.env.CDK_ENVIRONMENT || "dev";
  return `vcm-${baseName}-${environment}${branchSuffix()}`;
}

export function buildLambdaLogGroupName(namespace: string, baseName: string): string {
  const environment = process.env.CDK_ENVIRONMENT || "dev";
  return `/vcm/${environment}${branchSuffix()}/${namespace}/${baseName}`;
}
