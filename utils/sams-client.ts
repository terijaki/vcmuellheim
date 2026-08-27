import { createSamsClient, type SamsClient } from "sams-rest-v2";
import { SAMS } from "@project.config";

export type { SamsClient };

let cachedClient: SamsClient | undefined;

export function getSamsClient(): SamsClient {
  const apiKey = process.env.SAMS_API_KEY;
  if (!apiKey) {
    throw new Error("SAMS_API_KEY is not configured");
  }

  cachedClient ??= createSamsClient({
    baseUrl: `${SAMS.server}/api/v2`,
    apiKey,
  });

  return cachedClient;
}

/** Lazy singleton — all SAMS API callers should import this. */
export const sams: SamsClient = new Proxy({} as SamsClient, {
  get(_target, prop) {
    const client = getSamsClient();
    const value = client[prop as keyof SamsClient];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
