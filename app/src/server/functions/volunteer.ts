/**
 * Server functions for the Volunteer Event Planner feature.
 *
 * Server-only logic lives in volunteer.server.ts (import-protected).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { volunteerEventSchema, volunteerSignupDataSchema } from "@/lib/db/schemas";
import { requireAdminMiddleware } from "../../middleware";
import {
  cancelVolunteerSignupByAdmin,
  cancelVolunteerSignupByVolunteer,
  confirmVolunteerSignup,
  createVolunteerSignup,
  getPublicVolunteerEvent,
  handleArchiveVolunteerEvent,
  handleCreateVolunteerEvent,
  handleDeleteVolunteerEvent,
  handleGetVolunteerEvent,
  handleListVolunteerEvents,
  handleListVolunteerSignups,
  handleRestoreVolunteerEvent,
  handleUpdateVolunteerEvent,
  handleUpdateVolunteerSignup,
  sendBulkVolunteerEventEmail,
  verifyVolunteerToken,
} from "./volunteer.server";

const volunteerEventInputSchema = volunteerEventSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const listVolunteerEventsFn = createServerFn()
  .middleware([requireAdminMiddleware])
  .handler(async () => handleListVolunteerEvents());

export const getVolunteerEventFn = createServerFn()
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleGetVolunteerEvent(data.id));

export const createVolunteerEventFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(volunteerEventInputSchema)
  .handler(async ({ data }) => handleCreateVolunteerEvent(data));

export const updateVolunteerEventFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(
    z.object({
      id: z.uuid(),
      data: volunteerEventInputSchema.partial(),
    }),
  )
  .handler(async ({ data: { id, data: updates } }) => handleUpdateVolunteerEvent(id, updates));

export const deleteVolunteerEventFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleDeleteVolunteerEvent(data.id));

export const archiveVolunteerEventFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleArchiveVolunteerEvent(data.id));

export const restoreVolunteerEventFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleRestoreVolunteerEvent(data.id));

export const listVolunteerSignupsFn = createServerFn()
  .middleware([requireAdminMiddleware])
  .validator(z.object({ eventId: z.uuid() }))
  .handler(async ({ data }) => handleListVolunteerSignups(data.eventId));

export const updateVolunteerSignupFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(
    z.object({
      id: z.uuid(),
      data: z.object({
        assignedRoleId: z.uuid().nullable().optional(),
        shiftId: z.uuid().optional(),
      }),
    }),
  )
  .handler(async ({ data: { id, data: updates } }) => handleUpdateVolunteerSignup(id, updates));

export const cancelVolunteerSignupFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => cancelVolunteerSignupByAdmin(data));

export const confirmVolunteerSignupFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => confirmVolunteerSignup(data));

export const sendVolunteerBulkEmailFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(
    z.object({
      eventId: z.uuid(),
      subject: z.string().min(1).max(500),
      htmlBody: z.string().min(1),
      filters: z
        .object({
          shiftIds: z.array(z.uuid()).optional(),
          roleIds: z.array(z.uuid()).optional(),
          minDateOfBirth: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          maxDateOfBirth: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .optional(),
    }),
  )
  .handler(async ({ data }) => sendBulkVolunteerEventEmail(data));

export const getPublicVolunteerEventFn = createServerFn()
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => getPublicVolunteerEvent(data));

export const createVolunteerSignupFn = createServerFn({ method: "POST" })
  .validator(volunteerSignupDataSchema)
  .handler(async ({ data }) => createVolunteerSignup(data));

export const verifyVolunteerTokenFn = createServerFn()
  .validator(z.object({ tokenId: z.uuid() }))
  .handler(async ({ data }) => verifyVolunteerToken(data));

export const volunteerCancelSignupFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.uuid(),
      email: z.email().trim(),
    }),
  )
  .handler(async ({ data }) => cancelVolunteerSignupByVolunteer(data));
