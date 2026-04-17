/**
 * Server functions for the Volunteer Event Planner feature.
 *
 * Admin functions (requireAdminMiddleware):
 *   listVolunteerEventsFn, getVolunteerEventFn, createVolunteerEventFn,
 *   updateVolunteerEventFn, deleteVolunteerEventFn (blocked if signups exist),
 *   archiveVolunteerEventFn, restoreVolunteerEventFn,
 *   listVolunteerSignupsFn, updateVolunteerSignupFn, deleteVolunteerSignupFn,
 *   confirmVolunteerSignupFn (force-confirm)
 *
 * Public functions (no auth):
 *   getPublicVolunteerEventFn — event info + signup counts + confirmed helper names
 *   createVolunteerSignupFn  — creates pending signup on first submission + token + confirmation email
 *   verifyVolunteerTokenFn   — upserts signup to confirmed from token + receipt email
 *
 * Business logic lives in volunteer-handlers.ts so that server-only deps
 * (electrodb, SES, etc.) are never pulled into the client bundle.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { volunteerEventSchema, volunteerSignupDataSchema, volunteerSignupSchema } from "@/lib/db/schemas";
import { requireAdminMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";
import { confirmVolunteerSignup, createVolunteerSignup, getPublicVolunteerEvent, verifyVolunteerToken } from "./volunteer-handlers";

// ---------------------------------------------------------------------------
// Admin — Events CRUD
// ---------------------------------------------------------------------------

export const listVolunteerEventsFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.handler(async () => {
		const result = await db().volunteerEvent.query.byType({ type: "volunteerEvent" }).go({ pages: "all" });
		const items = parseServerArray(volunteerEventSchema, result.data, "Failed to parse volunteer event list");
		return { items };
	});

export const getVolunteerEventFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().volunteerEvent.get({ id: data.id }).go();
		if (!result.data) throw new Error("Volunteer event not found");
		return parseServerData(volunteerEventSchema, result.data, "Failed to parse volunteer event");
	});

const volunteerEventInputSchema = volunteerEventSchema.omit({ id: true, createdAt: true, updatedAt: true });

export const createVolunteerEventFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(volunteerEventInputSchema)
	.handler(async ({ data }) => {
		const event = withTimestamps({ ...data, id: crypto.randomUUID() });
		await db().volunteerEvent.create(event).go();
		return event;
	});

export const updateVolunteerEventFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: volunteerEventInputSchema.partial(),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		// When shifts are updated, clear assignedRoleId on any signup that
		// referenced a role that no longer exists in the new shift structure.
		if (updates.shifts) {
			const current = await db().volunteerEvent.get({ id }).go();
			if (current.data) {
				const currentEvent = parseServerData(volunteerEventSchema, current.data, "Failed to parse volunteer event");
				const oldRoleIds = new Set(currentEvent.shifts.flatMap((s) => s.roles.map((r) => r.id)));
				const newRoleIds = new Set(updates.shifts.flatMap((s) => s.roles.map((r) => r.id)));
				const deletedRoleIds = new Set([...oldRoleIds].filter((rid) => !newRoleIds.has(rid)));

				if (deletedRoleIds.size > 0) {
					const signupsResult = await db().volunteerSignup.query.byEvent({ eventId: id }).go({ pages: "all" });
					const affectedSignups = signupsResult.data.filter((s) => s.assignedRoleId && deletedRoleIds.has(s.assignedRoleId));
					await Promise.all(affectedSignups.map((s) => db().volunteerSignup.patch({ id: s.id }).set({ updatedAt: new Date().toISOString() }).remove(["assignedRoleId"]).go()));
				}
			}
		}

		await db()
			.volunteerEvent.patch({ id })
			.set({ ...updates, updatedAt: new Date().toISOString() })
			.go();
		const refreshed = await db().volunteerEvent.get({ id }).go();
		if (!refreshed.data) throw new Error("Volunteer event not found");
		return parseServerData(volunteerEventSchema, refreshed.data, "Failed to parse volunteer event");
	});

export const deleteVolunteerEventFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		// Block deletion if any signups exist — use archive instead
		const signupsResult = await db().volunteerSignup.query.byEvent({ eventId: data.id }).go({ pages: "all" });
		if (signupsResult.data.length > 0) {
			throw new Error("Cannot delete an event with existing signups. Archive it instead.");
		}
		await db().volunteerEvent.delete({ id: data.id }).go();
		return { success: true };
	});

export const archiveVolunteerEventFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().volunteerEvent.patch({ id: data.id }).set({ archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).go();
		return { success: true };
	});

export const restoreVolunteerEventFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().volunteerEvent.patch({ id: data.id }).set({ updatedAt: new Date().toISOString() }).remove(["archivedAt"]).go();
		return { success: true };
	});

// ---------------------------------------------------------------------------
// Admin — Signups management
// ---------------------------------------------------------------------------

export const listVolunteerSignupsFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(z.object({ eventId: z.uuid() }))
	.handler(async ({ data }) => {
		const result = await db().volunteerSignup.query.byEvent({ eventId: data.eventId }).go({ pages: "all" });
		const items = parseServerArray(volunteerSignupSchema, result.data, "Failed to parse signup list");
		return { items };
	});

export const updateVolunteerSignupFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(
		z.object({
			id: z.uuid(),
			data: z.object({
				assignedRoleId: z.uuid().nullable().optional(),
				shiftId: z.uuid().optional(),
			}),
		}),
	)
	.handler(async ({ data: { id, data: updates } }) => {
		const setFields: Record<string, unknown> = { updatedAt: new Date().toISOString() };
		if (updates.shiftId !== undefined) setFields.shiftId = updates.shiftId;

		const patchOp = db().volunteerSignup.patch({ id }).set(setFields);
		const result =
			updates.assignedRoleId === null
				? await patchOp.remove(["assignedRoleId"]).go()
				: updates.assignedRoleId !== undefined
					? await db()
							.volunteerSignup.patch({ id })
							.set({ ...setFields, assignedRoleId: updates.assignedRoleId })
							.go()
					: await patchOp.go();

		if (!result.data) throw new Error("Signup not found");
		const refreshed = await db().volunteerSignup.get({ id }).go();
		if (!refreshed.data) throw new Error("Signup not found");
		return parseServerData(volunteerSignupSchema, refreshed.data, "Failed to parse signup");
	});

export const deleteVolunteerSignupFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => {
		await db().volunteerSignup.delete({ id: data.id }).go();
		return { success: true };
	});

export const confirmVolunteerSignupFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => confirmVolunteerSignup(data));

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export const getPublicVolunteerEventFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => getPublicVolunteerEvent(data));

export const createVolunteerSignupFn = createServerFn()
	.inputValidator(volunteerSignupDataSchema)
	.handler(async ({ data }) => createVolunteerSignup(data));

export const verifyVolunteerTokenFn = createServerFn()
	.inputValidator(z.object({ tokenId: z.uuid() }))
	.handler(async ({ data }) => verifyVolunteerToken(data));
