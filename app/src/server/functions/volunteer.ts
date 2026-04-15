/**
 * Server functions for the Volunteer Event Planner feature.
 *
 * Admin functions (requireAdminMiddleware):
 *   listVolunteerEventsFn, getVolunteerEventFn, createVolunteerEventFn,
 *   updateVolunteerEventFn, deleteVolunteerEventFn,
 *   listVolunteerSignupsFn, updateVolunteerSignupFn, deleteVolunteerSignupFn,
 *   confirmVolunteerSignupFn (force-confirm)
 *
 * Public functions (no auth):
 *   getPublicVolunteerEventFn — event info + signup counts + confirmed helper names
 *   createVolunteerSignupFn  — creates pending signup on first submission + token + confirmation email
 *   verifyVolunteerTokenFn   — upserts signup to confirmed from token + receipt email
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { volunteerEventSchema, volunteerSignupDataSchema, volunteerSignupSchema, volunteerTokenSchema } from "@/lib/db/schemas";
import { requireAdminMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";
import { sendVolunteerConfirmationEmail, sendVolunteerReceiptEmail } from "./volunteer-email";
import type { VolunteerEvent, VolunteerSignup } from "@/lib/db/types";

// 72 hours in seconds
const TOKEN_TTL_SECONDS = 72 * 60 * 60;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Retrieve all signups for an event from GSI6. */
async function getSignupsForEvent(eventId: string): Promise<VolunteerSignup[]> {
	const result = await db().volunteerSignup.query.byEvent({ eventId }).go({ pages: "all" });
	return parseServerArray(volunteerSignupSchema, result.data, "Failed to parse signup list");
}

/** Find an existing signup by email + eventId + shiftId (in-memory filter). */
async function findExistingSignup(email: string, eventId: string, shiftId: string): Promise<VolunteerSignup | undefined> {
	const signups = await getSignupsForEvent(eventId);
	return signups.find((s) => s.email.toLowerCase() === email.toLowerCase() && s.shiftId === shiftId);
}

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
		await db().volunteerEvent.delete({ id: data.id }).go();
		return { success: true };
	});

// ---------------------------------------------------------------------------
// Admin — Signups management
// ---------------------------------------------------------------------------

export const listVolunteerSignupsFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(z.object({ eventId: z.uuid() }))
	.handler(async ({ data }) => {
		const items = await getSignupsForEvent(data.eventId);
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

/** Force-confirm a pending signup (skip email verification). */
export async function confirmVolunteerSignup(data: { id: string }) {
	const existing = await db().volunteerSignup.get({ id: data.id }).go();
	if (!existing.data) throw new Error("Signup not found");
	await db().volunteerSignup.patch({ id: data.id }).set({ status: "confirmed", updatedAt: new Date().toISOString() }).go();
	const refreshed = await db().volunteerSignup.get({ id: data.id }).go();
	if (!refreshed.data) throw new Error("Signup not found");
	return parseServerData(volunteerSignupSchema, refreshed.data, "Failed to parse signup");
}

export const confirmVolunteerSignupFn = createServerFn()
	.middleware([requireAdminMiddleware])
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => confirmVolunteerSignup(data));

// ---------------------------------------------------------------------------
// Public — Event view
// ---------------------------------------------------------------------------

export type PublicSignupSummary = {
	/** "FirstName L." */
	displayName: string;
	shiftId: string;
	/** roleId the admin assigned, or first preferred role if not yet assigned */
	roleId: string | null;
};

export type PublicVolunteerEventData = VolunteerEvent & {
	/** signupCounts[shiftId][roleId] = number of confirmed signups */
	signupCounts: Record<string, Record<string, number>>;
	confirmedHelpers: PublicSignupSummary[];
};

export async function getPublicVolunteerEvent(data: { id: string }): Promise<PublicVolunteerEventData> {
	const eventResult = await db().volunteerEvent.get({ id: data.id }).go();
	if (!eventResult.data) throw new Error("Event not found");
	const event = parseServerData(volunteerEventSchema, eventResult.data, "Failed to parse event") satisfies VolunteerEvent;

	const signupsResult = await db().volunteerSignup.query.byEvent({ eventId: data.id }).go({ pages: "all" });
	const allSignups = parseServerArray(volunteerSignupSchema, signupsResult.data, "Failed to parse signups");

	// Build signup counts per shift per role (confirmed only)
	const signupCounts: Record<string, Record<string, number>> = {};
	const confirmedHelpers: PublicSignupSummary[] = [];

	for (const signup of allSignups) {
		if (signup.status === "confirmed") {
			// Signup counts
			if (!signupCounts[signup.shiftId]) signupCounts[signup.shiftId] = {};
			const roleIds = signup.assignedRoleId ? [signup.assignedRoleId] : signup.preferredRoleIds;
			for (const roleId of roleIds) {
				signupCounts[signup.shiftId][roleId] = (signupCounts[signup.shiftId][roleId] ?? 0) + 1;
			}

			// "Erika M." display name
			const lastInitial = signup.lastName.charAt(0).toUpperCase();
			confirmedHelpers.push({
				displayName: `${signup.firstName} ${lastInitial}.`,
				shiftId: signup.shiftId,
				roleId: signup.assignedRoleId ?? signup.preferredRoleIds[0] ?? null,
			});
		}
	}

	return { ...event, signupCounts, confirmedHelpers };
}

export const getPublicVolunteerEventFn = createServerFn()
	.inputValidator(z.object({ id: z.uuid() }))
	.handler(async ({ data }) => getPublicVolunteerEvent(data));

// ---------------------------------------------------------------------------
// Public — Signup submission
// ---------------------------------------------------------------------------

export async function createVolunteerSignup(data: z.infer<typeof volunteerSignupDataSchema>) {
	// Check that the shift's startDate is in the future
	const eventResult = await db().volunteerEvent.get({ id: data.eventId }).go();
	if (!eventResult.data) throw new Error("Event not found");
	const event = parseServerData(volunteerEventSchema, eventResult.data, "Failed to parse event") satisfies VolunteerEvent;

	const shift = event.shifts.find((s) => s.id === data.shiftId);
	if (!shift) throw new Error("Shift not found");
	if (new Date(shift.startDate) <= new Date()) throw new Error("This shift has already started");

	// Create token (always)
	const tokenId = crypto.randomUUID();
	const ttl = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
	const token = {
		id: tokenId,
		type: "volunteerToken" as const,
		eventId: data.eventId,
		signupData: data,
		ttl,
		createdAt: new Date().toISOString(),
	};
	await db().volunteerToken.create(token).go();

	// Create pending signup only if no existing record for email+shift
	const existing = await findExistingSignup(data.email, data.eventId, data.shiftId);
	if (!existing) {
		const signup = withTimestamps({
			...data,
			id: crypto.randomUUID(),
			type: "volunteerSignup" as const,
			status: "pending" as const,
		});
		await db().volunteerSignup.create(signup).go();
	}

	// Send confirmation email
	await sendVolunteerConfirmationEmail({
		toEmail: data.email,
		firstName: data.firstName,
		event,
		shiftId: data.shiftId,
		tokenId,
	});

	return { success: true };
}

export const createVolunteerSignupFn = createServerFn()
	.inputValidator(volunteerSignupDataSchema)
	.handler(async ({ data }) => createVolunteerSignup(data));

// ---------------------------------------------------------------------------
// Public — Token verification
// ---------------------------------------------------------------------------

export async function verifyVolunteerToken(data: { tokenId: string }) {
	const tokenResult = await db().volunteerToken.get({ id: data.tokenId }).go();
	if (!tokenResult.data) throw new Error("Token not found or expired");

	const token = parseServerData(volunteerTokenSchema, tokenResult.data, "Failed to parse token");

	// Check TTL manually (DDB may not have removed it yet in fast tests)
	const nowSeconds = Math.floor(Date.now() / 1000);
	if (token.ttl < nowSeconds) throw new Error("Token has expired");

	const signupData = token.signupData;

	// Fetch event
	const eventResult = await db().volunteerEvent.get({ id: signupData.eventId }).go();
	if (!eventResult.data) throw new Error("Event not found");
	const event = parseServerData(volunteerEventSchema, eventResult.data, "Failed to parse event") satisfies VolunteerEvent;

	// Upsert signup to confirmed
	const existing = await findExistingSignup(signupData.email, signupData.eventId, signupData.shiftId);

	let signup: VolunteerSignup;
	if (existing) {
		// Update existing record with new data + confirmed status
		await db()
			.volunteerSignup.patch({ id: existing.id })
			.set({
				firstName: signupData.firstName,
				lastName: signupData.lastName,
				preferredRoleIds: signupData.preferredRoleIds,
				association: signupData.association,
				dateOfBirth: signupData.dateOfBirth,
				status: "confirmed",
				updatedAt: new Date().toISOString(),
			})
			.go();
		const refreshed = await db().volunteerSignup.get({ id: existing.id }).go();
		if (!refreshed.data) throw new Error("Signup not found after update");
		signup = parseServerData(volunteerSignupSchema, refreshed.data, "Failed to parse signup");
	} else {
		// Create confirmed signup from token data
		const newSignup = withTimestamps({
			...signupData,
			id: crypto.randomUUID(),
			type: "volunteerSignup" as const,
			status: "confirmed" as const,
		});
		await db().volunteerSignup.create(newSignup).go();
		signup = parseServerData(volunteerSignupSchema, newSignup, "Failed to parse signup");
	}

	// Delete token
	await db().volunteerToken.delete({ id: data.tokenId }).go();

	// Send receipt email with .ics
	await sendVolunteerReceiptEmail({ signup, event });

	return { success: true, shiftId: signup.shiftId };
}

export const verifyVolunteerTokenFn = createServerFn()
	.inputValidator(z.object({ tokenId: z.uuid() }))
	.handler(async ({ data }) => verifyVolunteerToken(data));
