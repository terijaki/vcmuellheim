/**
 * HTTP adapter for programmatic bus booking management.
 */

import { busSchema } from "@/lib/db/schemas";
import {
  handleCreateBus,
  handleDeleteBus,
  handleGetBusById,
  handleListBus,
  handleUpdateBus,
} from "../bus.server";
import {
  errorResponse,
  invalidBodyResponse,
  json,
  readJsonBody,
  requireApiKeyScope,
  resourceId,
} from "./http.server";

const busBodySchema = busSchema.omit({
  id: true,
  type: true,
  createdAt: true,
  updatedAt: true,
  ttl: true,
});

const createBusBodySchema = busBodySchema;

const updateBusBodySchema = busBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

export async function listBusApi(request: Request): Promise<Response> {
  const denied = await requireApiKeyScope(request, "bus");
  if (denied) return denied;

  try {
    const result = await handleListBus();
    return json({ items: result.items });
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to list bus bookings");
  }
}

export async function getBusApi(request: Request, idParam: string): Promise<Response> {
  const id = resourceId(idParam);
  if (!id) return errorResponse(404, "not_found", "Bus booking not found");

  const denied = await requireApiKeyScope(request, "bus");
  if (denied) return denied;

  try {
    const booking = await handleGetBusById(id);
    if (!booking) return errorResponse(404, "not_found", "Bus booking not found");
    return json(booking);
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to read bus booking");
  }
}

export async function createBusApi(request: Request): Promise<Response> {
  const denied = await requireApiKeyScope(request, "bus");
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse(400, "invalid", "Invalid JSON body");

  const parsed = createBusBodySchema.safeParse(body.raw);
  if (!parsed.success) return invalidBodyResponse(parsed.error);

  try {
    const booking = await handleCreateBus({ ...parsed.data, type: "bus" });
    return json(booking, 201);
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to create bus booking");
  }
}

export async function updateBusApi(request: Request, idParam: string): Promise<Response> {
  const id = resourceId(idParam);
  if (!id) return errorResponse(404, "not_found", "Bus booking not found");

  const denied = await requireApiKeyScope(request, "bus");
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse(400, "invalid", "Invalid JSON body");

  const parsed = updateBusBodySchema.safeParse(body.raw);
  if (!parsed.success) return invalidBodyResponse(parsed.error);

  try {
    const existing = await handleGetBusById(id);
    if (!existing) return errorResponse(404, "not_found", "Bus booking not found");
    const booking = await handleUpdateBus(id, parsed.data);
    return json(booking);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return errorResponse(404, "not_found", "Bus booking not found");
    }
    console.error(error);
    return errorResponse(500, "internal", "Failed to update bus booking");
  }
}

export async function deleteBusApi(request: Request, idParam: string): Promise<Response> {
  const id = resourceId(idParam);
  if (!id) return errorResponse(404, "not_found", "Bus booking not found");

  const denied = await requireApiKeyScope(request, "bus", { requireAdmin: true });
  if (denied) return denied;

  try {
    const existing = await handleGetBusById(id);
    if (!existing) return errorResponse(404, "not_found", "Bus booking not found");
    await handleDeleteBus(id);
    return json({ success: true as const });
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to delete bus booking");
  }
}
