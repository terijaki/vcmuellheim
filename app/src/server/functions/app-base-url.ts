import { createServerFn } from "@tanstack/react-start";
import { buildWebappUrl } from "@utils/webapp-url";

export function buildAppBaseUrlFromEnv(env: NodeJS.ProcessEnv): string {
  const url = env.APP_BASE_URL;
  if (url) return url;
  return buildWebappUrl(env.CDK_ENVIRONMENT || "dev", env.BRANCH_NAME || "");
}

export function getAppBaseUrl(): string {
  return buildAppBaseUrlFromEnv(process.env);
}

export const getAppBaseUrlFn = createServerFn().handler(() => getAppBaseUrl());
