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
} from "./bus.server";
import {
  errorResponse,
  invalidBodyResponse,
  json,
  readJsonBody,
  requireApiKeyScope,
  resourceId,
} from "./admin-cms-api-http.server";

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

export async function handleBusApiRequest(request: Request, parts: string[]): Promise<Response> {
  if (parts.length === 1 && request.method === "GET") return listBus(request);
  if (parts.length === 1 && request.method === "POST") return createBusBooking(request);

  const id = parts.length >= 2 ? resourceId(parts[1] ?? "") : null;
  if (parts.length === 2 && request.method === "GET") {
    if (!id) return errorResponse(404, "not_found", "Bus booking not found");
    return getBusBooking(request, id);
  }
  if (parts.length === 2 && request.method === "PATCH") {
    if (!id) return errorResponse(404, "not_found", "Bus booking not found");
    return updateBusBooking(request, id);
  }
  if (parts.length === 2 && request.method === "DELETE") {
    if (!id) return errorResponse(404, "not_found", "Bus booking not found");
    return deleteBusBooking(request, id);
  }

  return errorResponse(404, "not_found", "Not found");
}

async function listBus(request: Request): Promise<Response> {
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

async function getBusBooking(request: Request, id: string): Promise<Response> {
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

async function createBusBooking(request: Request): Promise<Response> {
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

async function updateBusBooking(request: Request, id: string): Promise<Response> {
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

async function deleteBusBooking(request: Request, id: string): Promise<Response> {
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
