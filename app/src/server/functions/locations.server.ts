/**
 * Locations server-only helpers — DynamoDB access.
 */

import { z } from "zod";
import { locationRepository } from "@/lib/db/repositories/content-entities-repository";
import { locationSchema } from "@/lib/db/schemas";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";

const locationInputSchema = locationSchema.omit({ id: true, createdAt: true, updatedAt: true });

type LocationInput = z.infer<typeof locationInputSchema>;

export async function handleListLocations() {
  const locations = await locationRepository.listAll();
  const items = parseServerArray(locationSchema, locations, "Failed to parse location list");
  return { items, lastEvaluatedKey: undefined };
}

export async function handleCreateLocation(data: LocationInput) {
  const location = withTimestamps({
    ...data,
    id: crypto.randomUUID(),
  });

  await locationRepository.create(location);

  return location;
}

export async function handleUpdateLocation(id: string, updates: Partial<LocationInput>) {
  const location = await locationRepository.update(id, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  if (!location) throw new Error("Location not found");
  return parseServerData(locationSchema, location, "Failed to parse location data");
}

export async function handleDeleteLocation(id: string) {
  await locationRepository.delete(id);
  return { success: true as const };
}
