/**
 * Upload server functions — replaces lib/trpc/routers/upload.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthMiddleware } from "../../middleware";
import { handleGetFileUrl, handleGetFileUrls, handleGetPresignedUrl } from "./upload.server";

export const getFileUrlFn = createServerFn()
  .validator(z.object({ s3Key: z.string() }))
  .handler(async ({ data }) => handleGetFileUrl(data.s3Key));

export const getFileUrlsFn = createServerFn()
  .validator(z.object({ s3Keys: z.array(z.string()).optional().default([]) }))
  .handler(async ({ data }) => handleGetFileUrls(data.s3Keys));

export const getPresignedUrlFn = createServerFn()
  .middleware([requireAuthMiddleware])
  .validator(
    z.object({
      filename: z.string(),
      contentType: z.string(),
      folder: z.enum(["sponsors", "teams", "members", "news", "media"]).default("media"),
    }),
  )
  .handler(async ({ data }) => handleGetPresignedUrl(data));
