/**
 * Bus server-only helpers — DynamoDB access.
 */

import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { busSchema } from "@/lib/db/schemas";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";

const busInputSchema = busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true });

type BusInput = z.infer<typeof busInputSchema>;

export async function handleListBus() {
  const result = await db().bus.query.byType({ type: "bus" }).go({ pages: "all" });
  const items = parseServerArray(busSchema, result.data, "Failed to parse bus bookings");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
}

export async function handleCreateBus(data: BusInput) {
  const booking = withTimestamps({
    ...data,
    id: crypto.randomUUID(),
    ttl: dayjs(data.to).add(30, "day").unix(),
  });

  await db().bus.create(booking).go();

  return booking;
}

export async function handleUpdateBus(id: string, updates: Partial<BusInput>) {
  const ttl = updates.to ? dayjs(updates.to).add(30, "day").unix() : undefined;
  const result = await db()
    .bus.patch({ id })
    .set({
      ...updates,
      ...(ttl ? { ttl } : {}),
      updatedAt: new Date().toISOString(),
    })
    .go();

  if (!result.data) throw new Error("Bus booking not found");

  const refreshedResult = await db().bus.get({ id }).go();
  const booking = refreshedResult.data
    ? parseServerData(busSchema, refreshedResult.data, "Failed to parse bus booking")
    : null;

  if (!booking) throw new Error("Bus booking not found");
  return booking;
}

export async function handleDeleteBus(id: string) {
  await db().bus.delete({ id }).go();
  return { success: true as const };
}
