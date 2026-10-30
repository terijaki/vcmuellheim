/**
 * Events server-only helpers — DynamoDB access.
 */

import dayjs from "dayjs";
import { z } from "zod";
import { eventRepository } from "@/lib/db/repositories/content-entities-repository";
import { eventSchema } from "@/lib/db/schemas";
import { readUpcomingEvents, rebuildUpcomingEvents } from "@/lib/read-models/public-snapshots";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";
import { resolveNullableUpdates } from "./patch-helpers";

const eventInputSchema = eventSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  ttl: true,
});

const eventUpdateDataSchema = eventSchema
  .omit({ id: true, createdAt: true, updatedAt: true, ttl: true })
  .partial()
  .extend({
    description: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
    variant: z.string().nullable().optional(),
  });

type EventInput = z.infer<typeof eventInputSchema>;
type EventUpdateInput = z.infer<typeof eventUpdateDataSchema>;

export async function handleGetUpcomingEvents(data?: { limit?: number }) {
  const snapshot = await readUpcomingEvents();
  const limit = data?.limit ?? 20;
  return { items: (snapshot?.items ?? []).slice(0, limit), lastEvaluatedKey: undefined };
}

export async function handleGetEventById(id: string) {
  const event = await eventRepository.getById(id);
  return event ? parseServerData(eventSchema, event, "Failed to parse event data") : null;
}

export async function handleListAllEvents() {
  const events = await eventRepository.listAll();
  const items = parseServerArray(eventSchema, events, "Failed to parse event list");
  return { items, lastEvaluatedKey: undefined };
}

export async function handleCreateEvent(data: EventInput) {
  const event = withTimestamps({
    ...data,
    id: crypto.randomUUID(),
    ttl: dayjs(data.endDate || data.startDate)
      .add(90, "day")
      .unix(),
  });

  await eventRepository.create(event);
  await rebuildUpcomingEvents();

  return event;
}

export async function handleUpdateEvent(id: string, updates: EventUpdateInput) {
  const existing = await eventRepository.getById(id);
  if (!existing) throw new Error("Event not found");

  const { description, location, variant, ...restUpdates } = updates;
  const { setFields: nullableFields, removeKeys } = resolveNullableUpdates({
    description,
    location,
    variant,
  });

  const merged = {
    ...existing,
    ...restUpdates,
    ...nullableFields,
    ...(updates.endDate || updates.startDate
      ? {
          ttl: dayjs(updates.endDate || updates.startDate)
            .add(90, "day")
            .unix(),
        }
      : {}),
    updatedAt: new Date().toISOString(),
  } as Record<string, unknown>;
  for (const key of removeKeys) {
    delete merged[key];
  }

  const event = await eventRepository.update(id, merged);
  if (!event) throw new Error("Event not found");
  await rebuildUpcomingEvents();
  return event;
}

export async function handleDeleteEvent(id: string) {
  await eventRepository.delete(id);
  await rebuildUpcomingEvents();
  return { success: true as const };
}
