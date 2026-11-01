/**
 * HTTP adapter for programmatic events access (read-only).
 */

import { handleGetEventById, handleListAllEvents } from "./events.server";
import { errorResponse, json, requireApiKeyScope, resourceId } from "./admin-cms-api-http.server";

export async function handleEventsApiRequest(request: Request, parts: string[]): Promise<Response> {
  if (parts.length === 1 && request.method === "GET") return listEvents(request);

  const id = parts.length >= 2 ? resourceId(parts[1] ?? "") : null;
  if (parts.length === 2 && request.method === "GET") {
    if (!id) return errorResponse(404, "not_found", "Event not found");
    return getEvent(request, id);
  }

  return errorResponse(404, "not_found", "Not found");
}

async function listEvents(request: Request): Promise<Response> {
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

async function getEvent(request: Request, id: string): Promise<Response> {
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
