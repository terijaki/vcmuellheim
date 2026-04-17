/**
 * Business logic for the Volunteer Event Planner feature.
 *
 * Extracted from volunteer.ts so that route-imported server functions
 * (createServerFn) don't pull server-only deps (electrodb, SES, etc.)
 * into the client bundle.
 *
 * Tests import directly from this file; routes import only the
 * createServerFn wrappers from volunteer.ts.
 */

import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { volunteerEventSchema, volunteerSignupDataSchema, volunteerSignupSchema, volunteerTokenSchema } from "@/lib/db/schemas";
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
// Public — Event view
// ---------------------------------------------------------------------------

export type PublicSignupSummary = {
	/** "FirstName L." */
	displayName: string;
	shiftId: string;
	/** roleId explicitly assigned by admin; null means benched (confirmed but awaiting assignment) */
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

	// Archived events are hidden from public view
	if (event.archivedAt) throw new Error("Event not found");

	// Filter out archived shifts before returning
	const activeShifts = event.shifts.filter((s) => !s.archivedAt);

	const signupsResult = await db().volunteerSignup.query.byEvent({ eventId: data.id }).go({ pages: "all" });
	const allSignups = parseServerArray(volunteerSignupSchema, signupsResult.data, "Failed to parse signups");

	// Build signup counts per shift per role (confirmed only)
	const signupCounts: Record<string, Record<string, number>> = {};
	const confirmedHelpers: PublicSignupSummary[] = [];

	for (const signup of allSignups) {
		if (signup.status === "confirmed") {
			// Signup counts — only count explicitly assigned roles (no fallback to preferred)
			// Signups without an assignedRoleId are "benched": confirmed but not yet placed.
			if (signup.assignedRoleId) {
				if (!signupCounts[signup.shiftId]) signupCounts[signup.shiftId] = {};
				signupCounts[signup.shiftId][signup.assignedRoleId] = (signupCounts[signup.shiftId][signup.assignedRoleId] ?? 0) + 1;
			}

			// "Erika M." display name; roleId null = benched
			const lastInitial = signup.lastName.charAt(0).toUpperCase();
			confirmedHelpers.push({
				displayName: `${signup.firstName} ${lastInitial}.`,
				shiftId: signup.shiftId,
				roleId: signup.assignedRoleId ?? null,
			});
		}
	}

	return { ...event, shifts: activeShifts, signupCounts, confirmedHelpers };
}

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
	if (shift.archivedAt) throw new Error("Diese Schicht ist nicht mehr verfügbar");
	if (new Date(shift.startDate) <= new Date()) throw new Error("This shift has already started");

	// Validate minimum age requirements for each preferred role
	const ageAtShift = dayjs(shift.startDate).diff(dayjs(data.dateOfBirth), "year");
	for (const roleId of data.preferredRoleIds) {
		const role = shift.roles.find((r) => r.id === roleId);
		if (role?.minAge !== undefined && ageAtShift < role.minAge) {
			throw new Error(`Du erfüllst nicht das Mindestalter für die Aufgabe: ${role.label}`);
		}
	}

	// Emergency contact is required for minors (under 18 at shift start)
	if (ageAtShift < 18 && !data.emergencyContact) {
		throw new Error("Für Minderjährige ist eine Notfall-Kontaktnummer erforderlich");
	}

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

// ---------------------------------------------------------------------------
// Public — Token verification
// ---------------------------------------------------------------------------

export async function verifyVolunteerToken(data: { tokenId: string }) {
	const tokenResult = await db().volunteerToken.get({ id: data.tokenId }).go();
	if (!tokenResult.data) {
		console.warn("[verifyVolunteerToken] Token not found:", data.tokenId);
		return { success: false, shiftId: null };
	}

	const token = parseServerData(volunteerTokenSchema, tokenResult.data, "Failed to parse token");

	// Check TTL manually (DDB may not have removed it yet in fast tests)
	const nowSeconds = Math.floor(Date.now() / 1000);
	if (token.ttl < nowSeconds) {
		console.warn("[verifyVolunteerToken] Token expired:", data.tokenId);
		return { success: false, shiftId: null };
	}

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
				mobilePhone: signupData.mobilePhone,
				emergencyContact: signupData.emergencyContact,
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

	// Auto-assign to first preferred role with available capacity
	const shift = event.shifts.find((s) => s.id === signupData.shiftId);
	if (shift && shift.roles.length > 0) {
		// Build a count of confirmed+assigned signups for this shift (excluding the one just confirmed)
		const allShiftSignups = await getSignupsForEvent(signupData.eventId);
		const roleCountMap: Record<string, number> = {};
		for (const s of allShiftSignups) {
			if (s.status === "confirmed" && s.assignedRoleId && s.shiftId === signupData.shiftId && s.id !== signup.id) {
				roleCountMap[s.assignedRoleId] = (roleCountMap[s.assignedRoleId] ?? 0) + 1;
			}
		}
		const userAgeAtShift = dayjs(shift.startDate).diff(dayjs(signupData.dateOfBirth), "year");
		const availableRole = signupData.preferredRoleIds
			.map((rid) => shift.roles.find((r) => r.id === rid))
			.find((role) => role !== undefined && (roleCountMap[role.id] ?? 0) < role.maxCapacity && (role.minAge === undefined || userAgeAtShift >= role.minAge));
		if (availableRole) {
			await db().volunteerSignup.patch({ id: signup.id }).set({ assignedRoleId: availableRole.id, updatedAt: new Date().toISOString() }).go();
			signup = { ...signup, assignedRoleId: availableRole.id };
		}
	}

	// Delete token before sending email — a second concurrent call will fail at token lookup
	await db().volunteerToken.delete({ id: data.tokenId }).go();

	// Send receipt email with .ics
	await sendVolunteerReceiptEmail({ signup, event });

	return { success: true, shiftId: signup.shiftId };
}

// ---------------------------------------------------------------------------
// Admin — Force-confirm
// ---------------------------------------------------------------------------

/** Force-confirm a pending signup (skip email verification). */
export async function confirmVolunteerSignup(data: { id: string }) {
	const existing = await db().volunteerSignup.get({ id: data.id }).go();
	if (!existing.data) throw new Error("Signup not found");
	await db().volunteerSignup.patch({ id: data.id }).set({ status: "confirmed", updatedAt: new Date().toISOString() }).go();
	const refreshed = await db().volunteerSignup.get({ id: data.id }).go();
	if (!refreshed.data) throw new Error("Signup not found");
	return parseServerData(volunteerSignupSchema, refreshed.data, "Failed to parse signup");
}
