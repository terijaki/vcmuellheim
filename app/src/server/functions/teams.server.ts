/**
 * Teams server-only helpers — DynamoDB access.
 */

import { slugify } from "@utils/slugify";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { teamSchema } from "@/lib/db/schemas";
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
  const result = await db().team.query.byType({ type: "team" }).go({ pages: "all" });
  const items = parseServerArray(teamSchema, result.data, "Failed to parse team list");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
}

export async function handleGetTeamBySlug(slug: string) {
  const result = await db().team.query.bySlug({ slug }).go({ limit: 1 });
  return result.data[0]
    ? parseServerData(teamSchema, result.data[0], "Failed to parse team data")
    : null;
}

export async function handleCreateTeam(data: TeamInput) {
  const id = crypto.randomUUID();
  const slug = slugify(data.name, true);
  const team = withTimestamps({
    ...data,
    id,
    slug,
  });

  await db().team.create(team).go();

  return team;
}

export async function handleUpdateTeam(id: string, updates: TeamUpdateInput) {
  const { description, sbvvTeamId, ageGroup, league, name, ...restUpdates } = updates;
  const { setFields: nullableFields, removeKeys } = resolveNullableUpdates({
    description,
    sbvvTeamId,
    ageGroup,
    league,
  });

  const setFields = {
    ...restUpdates,
    ...nullableFields,
    ...(name !== undefined ? { name, slug: slugify(name, true) } : {}),
    updatedAt: new Date().toISOString(),
  };

  const patchOp = db().team.patch({ id }).set(setFields);
  const result = await (removeKeys.length > 0 ? patchOp.remove(removeKeys) : patchOp).go();

  if (!result.data) throw new Error("Team not found");

  const refreshedResult = await db().team.get({ id }).go();
  const team = refreshedResult.data
    ? parseServerData(teamSchema, refreshedResult.data, "Failed to parse team data")
    : null;

  if (!team) throw new Error("Team not found");
  return team;
}

export async function handleDeleteTeam(id: string) {
  await db().team.delete({ id }).go();
  return { success: true as const };
}
