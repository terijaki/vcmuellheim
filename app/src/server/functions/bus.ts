/**
 * Bus server functions — replaces lib/trpc/routers/bus.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { busSchema } from "@/lib/db/schemas";
import { requireAuthMiddleware } from "../../middleware";
import { handleCreateBus, handleDeleteBus, handleListBus, handleUpdateBus } from "./bus.server";

export const listBusFn = createServerFn().handler(async () => handleListBus());

export const createBusFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }))
  .handler(async ({ data }) => handleCreateBus(data));

export const updateBusFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(
    z.object({
      id: z.uuid(),
      data: busSchema.omit({ id: true, createdAt: true, updatedAt: true, ttl: true }).partial(),
    }),
  )
  .handler(async ({ data: { id, data: updates } }) => handleUpdateBus(id, updates));

export const deleteBusFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleDeleteBus(data.id));
