/**
 * HTTP adapter for programmatic events access (read-only).
 */

import { handleGetEventById, handleListAllEvents } from "../events.server";
import { errorResponse, json, requireApiKeyScope, resourceId } from "./http.server";

export async function listEventsApi(request: Request): Promise<Response> {
  const denied = await requireApiKeyScope(request, "events");
  if (denied) return denied;

  try {
    const result = await handleListAllEvents();
    return json({ items: result.items });
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to list events");
  }
}

export async function getEventApi(request: Request, idParam: string): Promise<Response> {
  const id = resourceId(idParam);
  if (!id) return errorResponse(404, "not_found", "Event not found");

  const denied = await requireApiKeyScope(request, "events");
  if (denied) return denied;

  try {
    const event = await handleGetEventById(id);
    if (!event) return errorResponse(404, "not_found", "Event not found");
    return json(event);
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to read event");
  }
}
