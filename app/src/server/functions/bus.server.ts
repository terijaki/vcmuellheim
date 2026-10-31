/**
 * Bus server-only helpers — DynamoDB access.
 */

import dayjs from "dayjs";
import { z } from "zod";
import { busRepository } from "@/lib/db/repositories/content-entities-repository";
import { busSchema } from "@/lib/db/schemas";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";

const busInputSchema = busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true });

type BusInput = z.infer<typeof busInputSchema>;

export async function handleListBus() {
  const bookings = await busRepository.listAll();
  const items = parseServerArray(busSchema, bookings, "Failed to parse bus bookings");
  return { items, lastEvaluatedKey: undefined };
}

export async function handleCreateBus(data: BusInput) {
  const booking = withTimestamps({
    ...data,
    id: crypto.randomUUID(),
    ttl: dayjs(data.to).add(30, "day").unix(),
  });

  await busRepository.create(booking);

  return booking;
}

export async function handleUpdateBus(id: string, updates: Partial<BusInput>) {
  const ttl = updates.to ? dayjs(updates.to).add(30, "day").unix() : undefined;
  const booking = await busRepository.update(id, {
    ...updates,
    ...(ttl ? { ttl } : {}),
    updatedAt: new Date().toISOString(),
  });

  if (!booking) throw new Error("Bus booking not found");
  return parseServerData(busSchema, booking, "Failed to parse bus booking");
}

export async function handleDeleteBus(id: string) {
  await busRepository.delete(id);
  return { success: true as const };
}
