/**
 * Locations server-only helpers — DynamoDB access.
 */

import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { locationSchema } from "@/lib/db/schemas";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";

const locationInputSchema = locationSchema.omit({ id: true, createdAt: true, updatedAt: true });

type LocationInput = z.infer<typeof locationInputSchema>;

export async function handleListLocations() {
  const result = await db().location.query.byType({ type: "location" }).go({ pages: "all" });
  const items = parseServerArray(locationSchema, result.data, "Failed to parse location list");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
}

export async function handleCreateLocation(data: LocationInput) {
  const location = withTimestamps({
    ...data,
    id: crypto.randomUUID(),
  });

  await db().location.create(location).go();

  return location;
}

export async function handleUpdateLocation(id: string, updates: Partial<LocationInput>) {
  const result = await db()
    .location.patch({ id })
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .go();

  if (!result.data) throw new Error("Location not found");

  const refreshedResult = await db().location.get({ id }).go();
  const location = refreshedResult.data
    ? parseServerData(locationSchema, refreshedResult.data, "Failed to parse location data")
    : null;

  if (!location) throw new Error("Location not found");
  return location;
}

export async function handleDeleteLocation(id: string) {
  await db().location.delete({ id }).go();
  return { success: true as const };
}
