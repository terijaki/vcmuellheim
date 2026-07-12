/**
 * Events server functions — replaces lib/trpc/routers/events.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eventSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import {
  handleCreateEvent,
  handleDeleteEvent,
  handleGetEventById,
  handleGetUpcomingEvents,
  handleListAllEvents,
  handleUpdateEvent,
} from "./events.server";

export const getUpcomingEventsFn = createServerFn()
  .validator(z.object({ limit: z.number().min(1).max(100).optional().default(20) }).optional())
  .handler(async ({ data }) => handleGetUpcomingEvents(data));

export const getEventByIdFn = createServerFn()
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleGetEventById(data.id));

export const listAllEventsFn = createServerFn()
  .middleware([requireAuthMiddleware])
  .handler(async () => handleListAllEvents());

export const createEventFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(eventSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }))
  .handler(async ({ data }) => handleCreateEvent(data));

export const updateEventFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(
    z.object({
      id: z.uuid(),
      data: eventSchema
        .omit({ id: true, createdAt: true, updatedAt: true, ttl: true })
        .partial()
        .extend({
          description: z.string().nullable().optional(),
          location: z.string().nullable().optional(),
          variant: z.string().nullable().optional(),
        }),
    }),
  )
  .handler(async ({ data: { id, data: updates } }) => handleUpdateEvent(id, updates));

export const deleteEventFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleDeleteEvent(data.id));
