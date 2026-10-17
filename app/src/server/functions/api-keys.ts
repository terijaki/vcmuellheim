/**
 * Admin server functions for CMS API keys.
 * Create and delete only — scope, member, and expiry are fixed at creation.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createApiKeyInputSchema } from "@/lib/db/schemas";
import { requireAdminMiddleware } from "../../middleware";
import { createApiKey, deleteApiKey, listApiKeys } from "../api-keys.server";

export const listApiKeysFn = createServerFn()
  .middleware([requireAdminMiddleware])
  .handler(async () => listApiKeys());

export const createApiKeyFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(createApiKeyInputSchema)
  .handler(async ({ data }) => createApiKey(data));

export const deleteApiKeyFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => deleteApiKey(data.id));
