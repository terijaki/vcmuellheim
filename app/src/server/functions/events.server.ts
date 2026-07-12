/**
 * Events server-only helpers — DynamoDB access.
 */

import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { eventSchema } from "@/lib/db/schemas";
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
  const result = await db()
    .event.query.byType({ type: "event" })
    .gte({ startDate: dayjs().toISOString() })
    .go({ limit: data?.limit ?? 20 });
  const items = parseServerArray(eventSchema, result.data, "Failed to parse upcoming events");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
}

export async function handleGetEventById(id: string) {
  const result = await db().event.get({ id }).go();
  return result.data
    ? parseServerData(eventSchema, result.data, "Failed to parse event data")
    : null;
}

export async function handleListAllEvents() {
  const result = await db().event.query.byType({ type: "event" }).go({ pages: "all" });
  const items = parseServerArray(eventSchema, result.data, "Failed to parse event list");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
}

export async function handleCreateEvent(data: EventInput) {
  const event = withTimestamps({
    ...data,
    id: crypto.randomUUID(),
    ttl: dayjs(data.endDate || data.startDate)
      .add(90, "day")
      .unix(),
  });

  await db().event.create(event).go();

  return event;
}

export async function handleUpdateEvent(id: string, updates: EventUpdateInput) {
  const { description, location, variant, ...restUpdates } = updates;
  const { setFields: nullableFields, removeKeys } = resolveNullableUpdates({
    description,
    location,
    variant,
  });

  const setFields = {
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
  };

  const patchOp = db().event.patch({ id }).set(setFields);
  const result = await (removeKeys.length > 0 ? patchOp.remove(removeKeys) : patchOp).go();

  if (!result.data) throw new Error("Event not found");

  const refreshedResult = await db().event.get({ id }).go();
  const event = refreshedResult.data
    ? parseServerData(eventSchema, refreshedResult.data, "Failed to parse event data")
    : null;

  if (!event) throw new Error("Event not found");
  return event;
}

export async function handleDeleteEvent(id: string) {
  await db().event.delete({ id }).go();
  return { success: true as const };
}
