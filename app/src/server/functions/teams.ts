/**
 * Teams server functions — replaces lib/trpc/routers/teams.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { teamSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import {
  handleCreateTeam,
  handleDeleteTeam,
  handleGetTeamBySlug,
  handleListTeams,
  handleUpdateTeam,
} from "./teams.server";

export const listTeamsFn = createServerFn().handler(async () => handleListTeams());

export const getTeamBySlugFn = createServerFn()
  .validator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => handleGetTeamBySlug(data.slug));

export const createTeamFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(teamSchema.omit({ id: true, createdAt: true, updatedAt: true, slug: true }))
  .handler(async ({ data }) => handleCreateTeam(data));

export const updateTeamFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(
    z.object({
      id: z.uuid(),
      data: teamSchema
        .omit({ id: true, createdAt: true, updatedAt: true, slug: true })
        .partial()
        .extend({
          description: z.string().nullable().optional(),
          sbvvTeamId: z.string().nullable().optional(),
          ageGroup: z.string().nullable().optional(),
          league: z.string().nullable().optional(),
        }),
    }),
  )
  .handler(async ({ data: { id, data: updates } }) => handleUpdateTeam(id, updates));

export const deleteTeamFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleDeleteTeam(data.id));
