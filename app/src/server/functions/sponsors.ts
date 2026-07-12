/**
 * Sponsors server functions — replaces lib/trpc/routers/sponsors.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sponsorSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import {
  handleCreateSponsor,
  handleDeleteSponsor,
  handleListSponsors,
  handleUpdateSponsor,
} from "./sponsors.server";

export const listSponsorsFn = createServerFn().handler(async () => handleListSponsors());

export const createSponsorFn = createServerFn()
  .middleware([requireAuthMiddleware])
  .validator(sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true }))
  .handler(async ({ data }) => handleCreateSponsor(data));

export const updateSponsorFn = createServerFn()
  .middleware([requireAuthMiddleware])
  .validator(
    z.object({
      id: z.uuid(),
      data: sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial().extend({
        description: z.string().nullable().optional(),
        websiteUrl: z.url().nullable().optional(),
        logoS3Key: z.string().nullable().optional(),
        ttl: z.number().int().positive().nullable().optional(),
      }),
    }),
  )
  .handler(async ({ data: { id, data: updates } }) => handleUpdateSponsor(id, updates));

export const deleteSponsorFn = createServerFn()
  .middleware([requireAuthMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleDeleteSponsor(data.id));
