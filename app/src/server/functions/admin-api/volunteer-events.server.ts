/**
 * HTTP adapter for programmatic volunteer events access.
 */

import {
  VolunteerEventUpdateConflictError,
  VolunteerEventUpdateInvalidIdsError,
  handleCreateVolunteerEvent,
  handleGetVolunteerEvent,
  handleListVolunteerEvents,
  handleListVolunteerSignups,
  handleUpdateVolunteerEvent,
  normalizeVolunteerEventShiftsForUpdate,
  parseVolunteerEventCreateBody,
  parseVolunteerEventUpdateBody,
  prepareVolunteerEventCreateInput,
  validateVolunteerEventShiftIdsForUpdate,
} from "../volunteer.server";
import {
  errorResponse,
  invalidBodyResponse,
  json,
  readJsonBody,
  requireApiKeyScope,
  resourceId,
} from "./http.server";

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

export async function createVolunteerEventApi(request: Request): Promise<Response> {
  const denied = await requireApiKeyScope(request, "volunteerEvents");
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse(400, "invalid", "Invalid JSON body");

  const parsed = parseVolunteerEventCreateBody(body.raw);
  if (!parsed.success) return invalidBodyResponse(parsed.error);

  try {
    const prepared = prepareVolunteerEventCreateInput(parsed.data);
    const event = await handleCreateVolunteerEvent(prepared);
    return json(event, 201);
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to create volunteer event");
  }
}

export async function updateVolunteerEventApi(
  request: Request,
  idParam: string,
): Promise<Response> {
  const id = resourceId(idParam);
  if (!id) return errorResponse(404, "not_found", "Volunteer event not found");

  const denied = await requireApiKeyScope(request, "volunteerEvents");
  if (denied) return denied;

  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse(400, "invalid", "Invalid JSON body");

  const parsed = parseVolunteerEventUpdateBody(body.raw);
  if (!parsed.success) return invalidBodyResponse(parsed.error);

  try {
    const existing = await handleGetVolunteerEvent(id);
    const { shifts, ...rest } = parsed.data;
    if (shifts) {
      validateVolunteerEventShiftIdsForUpdate(existing, shifts);
    }
    const updates = {
      ...rest,
      ...(shifts ? { shifts: normalizeVolunteerEventShiftsForUpdate(shifts) } : {}),
    };
    const event = await handleUpdateVolunteerEvent(id, updates, { registrationPolicy: "reject" });
    return json(event);
  } catch (error) {
    if (error instanceof VolunteerEventUpdateInvalidIdsError) {
      return errorResponse(400, "invalid", error.message, { details: error.details });
    }
    if (error instanceof VolunteerEventUpdateConflictError) {
      return errorResponse(409, "conflict", error.message, {
        reason: "registrations_block_removal",
        details: [
          ...(error.shiftIds.length > 0
            ? [
                {
                  path: "shifts",
                  message: `Shifts with registrations: ${error.shiftIds.join(", ")}`,
                },
              ]
            : []),
          ...(error.roleIds.length > 0
            ? [
                {
                  path: "shifts.roles",
                  message: `Roles with registrations: ${error.roleIds.join(", ")}`,
                },
              ]
            : []),
        ],
      });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return errorResponse(404, "not_found", "Volunteer event not found");
    }
    console.error(error);
    return errorResponse(500, "internal", "Failed to update volunteer event");
  }
}
