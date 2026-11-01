/**
 * HTTP adapter for programmatic volunteer events access (read-only).
 */

import { handleGetVolunteerEvent, handleListVolunteerEvents } from "./volunteer.server";
import { errorResponse, json, requireApiKeyScope, resourceId } from "./admin-cms-api-http.server";

export async function handleVolunteerEventsApiRequest(
  request: Request,
  parts: string[],
): Promise<Response> {
  if (parts.length === 1 && request.method === "GET") return listVolunteerEvents(request);

  const id = parts.length >= 2 ? resourceId(parts[1] ?? "") : null;
  if (parts.length === 2 && request.method === "GET") {
    if (!id) return errorResponse(404, "not_found", "Volunteer event not found");
    return getVolunteerEvent(request, id);
  }

  return errorResponse(404, "not_found", "Not found");
}

async function listVolunteerEvents(request: Request): Promise<Response> {
  const denied = await requireApiKeyScope(request, "volunteerEvents");
  if (denied) return denied;

  try {
    const result = await handleListVolunteerEvents();
    return json({ items: result.items });
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to list volunteer events");
  }
}

async function getVolunteerEvent(request: Request, id: string): Promise<Response> {
  const denied = await requireApiKeyScope(request, "volunteerEvents");
  if (denied) return denied;

  try {
    const event = await handleGetVolunteerEvent(id);
    return json(event);
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return errorResponse(404, "not_found", "Volunteer event not found");
    }
    console.error(error);
    return errorResponse(500, "internal", "Failed to read volunteer event");
  }
}
