/**
 * Locations server functions — replaces lib/trpc/routers/locations.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { locationSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import {
  handleCreateLocation,
  handleDeleteLocation,
  handleListLocations,
  handleUpdateLocation,
} from "./locations.server";

export const listLocationsFn = createServerFn().handler(async () => handleListLocations());

export const createLocationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(locationSchema.omit({ id: true, createdAt: true, updatedAt: true }))
  .handler(async ({ data }) => handleCreateLocation(data));

export const updateLocationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(
    z.object({
      id: z.uuid(),
      data: locationSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial(),
    }),
  )
  .handler(async ({ data: { id, data: updates } }) => handleUpdateLocation(id, updates));

export const deleteLocationFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleDeleteLocation(data.id));
