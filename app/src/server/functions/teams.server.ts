/**
 * Teams server-only helpers — DynamoDB access.
 */

import { slugify } from "@utils/slugify";
import { z } from "zod";
import { teamRepository } from "@/lib/db/repositories/team-repository";
import { teamSchema } from "@/lib/db/schemas";
import { rebuildUpcomingEvents } from "@/lib/read-models/public-snapshots";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";
import { resolveNullableUpdates } from "./patch-helpers";

const teamInputSchema = teamSchema.omit({ id: true, createdAt: true, updatedAt: true, slug: true });

const teamUpdateDataSchema = teamSchema
  .omit({ id: true, createdAt: true, updatedAt: true, slug: true })
  .partial()
  .extend({
    description: z.string().nullable().optional(),
    sbvvTeamId: z.string().nullable().optional(),
    ageGroup: z.string().nullable().optional(),
    league: z.string().nullable().optional(),
  });

type TeamInput = z.infer<typeof teamInputSchema>;
type TeamUpdateInput = z.infer<typeof teamUpdateDataSchema>;

export async function handleListTeams() {
  const teams = await teamRepository.listAll();
  const items = parseServerArray(teamSchema, teams, "Failed to parse team list");
  return { items, lastEvaluatedKey: undefined };
}

export async function handleGetTeamBySlug(slug: string) {
  const team = await teamRepository.getBySlug(slug);
  return team ? parseServerData(teamSchema, team, "Failed to parse team data") : null;
}

export async function handleCreateTeam(data: TeamInput) {
  const id = crypto.randomUUID();
  const slug = slugify(data.name, true);
  const team = withTimestamps({
    ...data,
    id,
    slug,
  });

  await teamRepository.create(team);
  await rebuildUpcomingEvents();

  return team;
}

export async function handleUpdateTeam(id: string, updates: TeamUpdateInput) {
  const existing = await teamRepository.getById(id);
  if (!existing) throw new Error("Team not found");

  const { description, sbvvTeamId, ageGroup, league, name, ...restUpdates } = updates;
  const { setFields: nullableFields, removeKeys } = resolveNullableUpdates({
    description,
    sbvvTeamId,
    ageGroup,
    league,
  });

  const merged = {
    ...existing,
    ...restUpdates,
    ...nullableFields,
    ...(name !== undefined ? { name, slug: slugify(name, true) } : {}),
    updatedAt: new Date().toISOString(),
  } as Record<string, unknown>;
  for (const key of removeKeys) {
    delete merged[key];
  }

  const team = await teamRepository.update(id, merged);
  if (!team) throw new Error("Team not found");
  await rebuildUpcomingEvents();
  return team;
}

export async function handleDeleteTeam(id: string) {
  await teamRepository.delete(id);
  await rebuildUpcomingEvents();
  return { success: true as const };
}
