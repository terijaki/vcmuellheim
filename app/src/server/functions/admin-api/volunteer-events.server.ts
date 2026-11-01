/**
 * HTTP adapter for programmatic volunteer events access (read-only).
 */

import {
  handleGetVolunteerEvent,
  handleListVolunteerEvents,
  handleListVolunteerSignups,
} from "../volunteer.server";
import { errorResponse, json, requireApiKeyScope, resourceId } from "./http.server";

export async function listVolunteerEventsApi(request: Request): Promise<Response> {
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

export async function getVolunteerEventApi(request: Request, idParam: string): Promise<Response> {
  const id = resourceId(idParam);
  if (!id) return errorResponse(404, "not_found", "Volunteer event not found");

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

export async function listVolunteerEventRegistrationsApi(
  request: Request,
  idParam: string,
): Promise<Response> {
  const id = resourceId(idParam);
  if (!id) return errorResponse(404, "not_found", "Volunteer event not found");

  const denied = await requireApiKeyScope(request, "volunteerEvents");
  if (denied) return denied;

  try {
    await handleGetVolunteerEvent(id);
    const result = await handleListVolunteerSignups(id);
    return json({ items: result.items });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return errorResponse(404, "not_found", "Volunteer event not found");
    }
    console.error(error);
    return errorResponse(500, "internal", "Failed to list volunteer event registrations");
  }
}
