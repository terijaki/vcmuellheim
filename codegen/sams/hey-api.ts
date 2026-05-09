import type { CreateClientConfig } from "./generated/client.gen";
import { SAMS } from "@/project.config";

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseUrl: `${SAMS.server}/api/v2`,
  headers: {
    "X-API-Key": process.env.SAMS_API_KEY || "",
    Accept: "*/*",
  },
});
