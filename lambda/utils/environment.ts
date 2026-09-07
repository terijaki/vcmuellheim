/** Shared CDK / Lambda environment helpers. */

export function isProdEnvironment(environment: string): boolean {
  return environment === "prod";
}
