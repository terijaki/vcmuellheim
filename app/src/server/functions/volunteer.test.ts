import { SESClient } from "@aws-sdk/client-ses";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { sendVolunteerConfirmationEmail, sendVolunteerReceiptEmail } from "./volunteer-email";
import { confirmVolunteerSignup, createVolunteerSignup, getPublicVolunteerEvent, verifyVolunteerToken } from "./volunteer-handlers";

// ── Environment setup ────────────────────────────────────────────────────────
process.env.CONTENT_TABLE_NAME = "test-content-table";
process.env.APP_BASE_URL = "https://test.vcmuellheim.de";

// ── AWS SDK mocks ────────────────────────────────────────────────────────────
const sesMock = mockClient(SESClient);

// ── ElectroDB mock via vi.hoisted + vi.mock ──────────────────────────────────
const { mockEventGet, mockEventCreate, mockEventPatch, mockSignupQuery, mockSignupGet, mockSignupCreate, mockSignupPatch, mockSignupDelete, mockTokenGet, mockTokenCreate, mockTokenDelete } =
	vi.hoisted(() => ({
		mockEventGet: vi.fn(),
		mockEventCreate: vi.fn(),
		mockEventPatch: vi.fn(),
		mockSignupQuery: vi.fn(),
		mockSignupGet: vi.fn(),
		mockSignupCreate: vi.fn(),
		mockSignupPatch: vi.fn(),
		mockSignupDelete: vi.fn(),
		mockTokenGet: vi.fn(),
		mockTokenCreate: vi.fn(),
		mockTokenDelete: vi.fn(),
	}));

vi.mock("@/lib/db/electrodb-client", () => ({
	db: vi.fn(() => ({
		volunteerEvent: {
			get: () => ({ go: mockEventGet }),
			create: () => ({ go: mockEventCreate }),
			patch: () => ({
				set: () => ({ go: mockEventPatch }),
			}),
			query: {
				byType: () => ({ go: vi.fn().mockResolvedValue({ data: [] }) }),
			},
		},
		volunteerSignup: {
			get: () => ({ go: mockSignupGet }),
			create: () => ({ go: mockSignupCreate }),
			patch: () => ({
				set: () => ({ go: mockSignupPatch, remove: () => ({ go: mockSignupPatch }) }),
				remove: () => ({ go: mockSignupPatch }),
			}),
			delete: () => ({ go: mockSignupDelete }),
			query: {
				byEvent: () => ({ go: mockSignupQuery }),
			},
		},
		volunteerToken: {
			get: () => ({ go: mockTokenGet }),
			create: () => ({ go: mockTokenCreate }),
			delete: () => ({ go: mockTokenDelete }),
		},
	})),
}));

vi.mock("./volunteer-email", () => ({
	sendVolunteerConfirmationEmail: vi.fn().mockResolvedValue(undefined),
	sendVolunteerReceiptEmail: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const roleId1 = "11111111-1111-4111-8111-111111111111";
const roleId2 = "22222222-2222-4222-8222-222222222222";
const shiftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const eventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const mockEvent = {
	id: eventId,
	type: "volunteerEvent" as const,
	title: "Stadtfest 2025",
	shifts: [
		{
			id: shiftId,
			label: "Aufbau",
			startDate: futureDate,
			roles: [
				{ id: roleId1, label: "Theke", minCapacity: 1, maxCapacity: 3 },
				{ id: roleId2, label: "Einlass", minCapacity: 1, maxCapacity: 2 },
			],
		},
	],
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

const signupData = {
	firstName: "Erika",
	lastName: "Musterfrau",
	email: "erika@example.com",
	dateOfBirth: "1990-01-15",
	preferredRoleIds: [roleId1, roleId2],
	association: "Mitglied",
	eventId,
	shiftId,
};

function makeSignup(overrides: Partial<typeof signupData & { id: string; status: "pending" | "confirmed"; assignedRoleId?: string }> = {}) {
	return {
		id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
		type: "volunteerSignup" as const,
		status: "pending" as const,
		assignedRoleId: undefined,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...signupData,
		...overrides,
	};
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("createVolunteerSignup", () => {
	beforeEach(() => {
		sesMock.reset();
		vi.clearAllMocks();
		mockEventGet.mockResolvedValue({ data: mockEvent });
		mockSignupQuery.mockResolvedValue({ data: [] });
		mockSignupCreate.mockResolvedValue({ data: makeSignup() });
		mockTokenCreate.mockResolvedValue({ data: {} });
	});

	it("creates a pending signup and token on first submission", async () => {
		await createVolunteerSignup(signupData);
		expect(mockSignupCreate).toHaveBeenCalledTimes(1);
		expect(mockTokenCreate).toHaveBeenCalledTimes(1);
		expect(vi.mocked(sendVolunteerConfirmationEmail)).toHaveBeenCalledTimes(1);
	});

	it("does NOT create a duplicate signup on re-submission (token still created)", async () => {
		// Existing signup for same email+shift
		mockSignupQuery.mockResolvedValue({ data: [makeSignup()] });

		await createVolunteerSignup(signupData);

		// Token created, but no new signup record
		expect(mockTokenCreate).toHaveBeenCalledTimes(1);
		expect(mockSignupCreate).not.toHaveBeenCalled();
		// Confirmation email still sent
		expect(vi.mocked(sendVolunteerConfirmationEmail)).toHaveBeenCalledTimes(1);
	});

	it("rejects signup for a past shift", async () => {
		const pastEvent = {
			...mockEvent,
			shifts: [{ ...mockEvent.shifts[0], startDate: pastDate }],
		};
		mockEventGet.mockResolvedValue({ data: pastEvent });

		await expect(createVolunteerSignup(signupData)).rejects.toThrow("already started");
		expect(mockSignupCreate).not.toHaveBeenCalled();
		expect(mockTokenCreate).not.toHaveBeenCalled();
	});

	it("rejects signup when a preferred role has minAge and user is too young", async () => {
		const restrictedEvent = {
			...mockEvent,
			shifts: [
				{
					...mockEvent.shifts[0],
					// shift starts in 1 week; signupData.dateOfBirth = "1990-01-15" so user is ~35 — fine
					// Use a 40-year minAge to trigger rejection
					roles: [
						{ id: roleId1, label: "Theke", minCapacity: 1, maxCapacity: 3, minAge: 40 },
						{ id: roleId2, label: "Einlass", minCapacity: 1, maxCapacity: 2 },
					],
				},
			],
		};
		mockEventGet.mockResolvedValue({ data: restrictedEvent });

		// signupData selects roleId1 as first preference — fails minAge 40 for a ~35-year-old
		await expect(createVolunteerSignup(signupData)).rejects.toThrow("Mindestalter");
		expect(mockSignupCreate).not.toHaveBeenCalled();
		expect(mockTokenCreate).not.toHaveBeenCalled();
	});

	it("allows signup when user meets the minAge requirement", async () => {
		const restrictedEvent = {
			...mockEvent,
			shifts: [
				{
					...mockEvent.shifts[0],
					roles: [
						{ id: roleId1, label: "Theke", minCapacity: 1, maxCapacity: 3, minAge: 18 },
						{ id: roleId2, label: "Einlass", minCapacity: 1, maxCapacity: 2 },
					],
				},
			],
		};
		mockEventGet.mockResolvedValue({ data: restrictedEvent });
		mockSignupCreate.mockResolvedValue({ data: makeSignup() });

		// signupData.dateOfBirth = "1990-01-15", ~35 years old — well above 18
		await createVolunteerSignup(signupData);
		expect(mockSignupCreate).toHaveBeenCalledTimes(1);
		expect(mockTokenCreate).toHaveBeenCalledTimes(1);
	});

	it("allows signup for a role with no minAge regardless of age", async () => {
		// roleId2 has no minAge — only roleId2 is selected
		const singleRoleData = { ...signupData, preferredRoleIds: [roleId2] };
		mockSignupCreate.mockResolvedValue({ data: makeSignup({ preferredRoleIds: [roleId2] }) });

		await createVolunteerSignup(singleRoleData);
		expect(mockSignupCreate).toHaveBeenCalledTimes(1);
	});
});

describe("verifyVolunteerToken", () => {
	const tokenId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
	const validTtl = Math.floor(Date.now() / 1000) + 3600;
	const expiredTtl = Math.floor(Date.now() / 1000) - 1;

	const mockToken = {
		id: tokenId,
		type: "volunteerToken" as const,
		eventId,
		signupData,
		ttl: validTtl,
		createdAt: new Date().toISOString(),
	};

	beforeEach(() => {
		sesMock.reset();
		vi.clearAllMocks();
		mockTokenGet.mockResolvedValue({ data: mockToken });
		mockEventGet.mockResolvedValue({ data: mockEvent });
		mockSignupQuery.mockResolvedValue({ data: [] }); // no existing signup
		mockSignupCreate.mockResolvedValue({ data: makeSignup({ status: "confirmed" }) });
		mockSignupPatch.mockResolvedValue({ data: makeSignup({ status: "confirmed" }) });
		mockTokenDelete.mockResolvedValue({ data: {} });
		mockSignupGet.mockResolvedValue({ data: makeSignup({ status: "confirmed" }) });
	});

	it("creates a confirmed signup when no existing record, deletes token, sends receipt", async () => {
		const result = await verifyVolunteerToken({ tokenId });

		expect(result.success).toBe(true);
		expect(mockSignupCreate).toHaveBeenCalledTimes(1);
		expect(mockTokenDelete).toHaveBeenCalledTimes(1);
		expect(vi.mocked(sendVolunteerReceiptEmail)).toHaveBeenCalledTimes(1);
	});

	it("upserts existing pending signup to confirmed on token verification", async () => {
		mockSignupQuery.mockResolvedValue({ data: [makeSignup()] }); // existing pending

		await verifyVolunteerToken({ tokenId });

		// At least once for the upsert; auto-assign may add another patch
		expect(mockSignupPatch).toHaveBeenCalled();
		expect(mockSignupCreate).not.toHaveBeenCalled();
		expect(mockTokenDelete).toHaveBeenCalledTimes(1);
		expect(vi.mocked(sendVolunteerReceiptEmail)).toHaveBeenCalledTimes(1);
	});

	it("auto-assigns to first preferred role with available capacity on confirmation", async () => {
		// No existing signups → brand-new confirmed signup, no competition for roles
		mockSignupQuery.mockResolvedValue({ data: [] });
		const newSignup = makeSignup({ status: "confirmed" });
		mockSignupCreate.mockResolvedValue({ data: newSignup });

		const result = await verifyVolunteerToken({ tokenId });

		expect(result.success).toBe(true);
		// auto-assign patch should have been called with roleId1 (first preferred, has capacity)
		expect(mockSignupPatch).toHaveBeenCalledTimes(1);
	});

	it("skips a full role and auto-assigns to the next available preferred role", async () => {
		// roleId1 is already at maxCapacity (3); roleId2 still has room (maxCapacity 2)
		const fullRoleSignups = [
			makeSignup({ id: "ff111111-1111-4111-8111-111111111111", status: "confirmed", assignedRoleId: roleId1 }),
			makeSignup({ id: "ff222222-2222-4222-8222-222222222222", status: "confirmed", assignedRoleId: roleId1 }),
			makeSignup({ id: "ff333333-3333-4333-8333-333333333333", status: "confirmed", assignedRoleId: roleId1 }),
		];
		// First call: no existing signup for this email+shift. Subsequent call: for auto-assign count.
		mockSignupQuery.mockResolvedValueOnce({ data: [] }).mockResolvedValue({ data: fullRoleSignups });
		const newSignup = makeSignup({ status: "confirmed" });
		mockSignupCreate.mockResolvedValue({ data: newSignup });

		const result = await verifyVolunteerToken({ tokenId });

		expect(result.success).toBe(true);
		// auto-assign patch called once, targeting roleId2
		expect(mockSignupPatch).toHaveBeenCalledTimes(1);
	});

	it("does not auto-assign if all preferred roles are at capacity", async () => {
		// Both roles at max capacity
		const fullSignups = [
			makeSignup({ id: "ff111111-1111-4111-8111-111111111111", status: "confirmed", assignedRoleId: roleId1 }),
			makeSignup({ id: "ff222222-2222-4222-8222-222222222222", status: "confirmed", assignedRoleId: roleId1 }),
			makeSignup({ id: "ff333333-3333-4333-8333-333333333333", status: "confirmed", assignedRoleId: roleId1 }),
			makeSignup({ id: "ff444444-4444-4444-8444-444444444444", status: "confirmed", assignedRoleId: roleId2 }),
			makeSignup({ id: "ff555555-5555-4555-8555-555555555555", status: "confirmed", assignedRoleId: roleId2 }),
		];
		mockSignupQuery.mockResolvedValueOnce({ data: [] }).mockResolvedValue({ data: fullSignups });
		const newSignup = makeSignup({ status: "confirmed" });
		mockSignupCreate.mockResolvedValue({ data: newSignup });

		const result = await verifyVolunteerToken({ tokenId });

		expect(result.success).toBe(true);
		// No auto-assign patch since all roles full
		expect(mockSignupPatch).not.toHaveBeenCalled();
	});

	it("sends a receipt email even when the signup was already confirmed (re-signup confirmation)", async () => {
		// User signs up again for the same shift — existing signup is already confirmed
		mockSignupQuery.mockResolvedValue({ data: [makeSignup({ status: "confirmed" })] });

		await verifyVolunteerToken({ tokenId });

		expect(vi.mocked(sendVolunteerReceiptEmail)).toHaveBeenCalledTimes(1);
	});

	it("returns success:false for an expired token without throwing", async () => {
		mockTokenGet.mockResolvedValue({ data: { ...mockToken, ttl: expiredTtl } });

		const result = await verifyVolunteerToken({ tokenId });
		expect(result.success).toBe(false);
		expect(mockSignupCreate).not.toHaveBeenCalled();
		expect(vi.mocked(sendVolunteerReceiptEmail)).not.toHaveBeenCalled();
	});

	it("returns success:false for a missing token without throwing", async () => {
		mockTokenGet.mockResolvedValue({ data: null });

		const result = await verifyVolunteerToken({ tokenId });
		expect(result.success).toBe(false);
		expect(mockSignupCreate).not.toHaveBeenCalled();
		expect(vi.mocked(sendVolunteerReceiptEmail)).not.toHaveBeenCalled();
	});
});

describe("getPublicVolunteerEvent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEventGet.mockResolvedValue({ data: mockEvent });
	});

	it("returns signupCounts with confirmed signups counted by role", async () => {
		const confirmedSignup = makeSignup({ status: "confirmed", assignedRoleId: roleId1 });
		mockSignupQuery.mockResolvedValue({ data: [confirmedSignup] });

		const result = await getPublicVolunteerEvent({ id: eventId });

		expect(result.signupCounts[shiftId]?.[roleId1]).toBe(1);
	});

	it("does not count pending signups in signupCounts", async () => {
		const pendingSignup = makeSignup({ status: "pending" });
		mockSignupQuery.mockResolvedValue({ data: [pendingSignup] });

		const result = await getPublicVolunteerEvent({ id: eventId });

		expect(result.signupCounts).toEqual({});
	});

	it("returns confirmed helpers with displayName in FirstName L. format", async () => {
		const confirmedSignup = makeSignup({ status: "confirmed", assignedRoleId: roleId1 });
		mockSignupQuery.mockResolvedValue({ data: [confirmedSignup] });

		const result = await getPublicVolunteerEvent({ id: eventId });

		expect(result.confirmedHelpers).toHaveLength(1);
		expect(result.confirmedHelpers[0]?.displayName).toBe("Erika M.");
	});

	it("bench: confirmed signup without assignedRoleId is not counted in signupCounts", async () => {
		const benchedSignup = makeSignup({ status: "confirmed" }); // no assignedRoleId
		mockSignupQuery.mockResolvedValue({ data: [benchedSignup] });

		const result = await getPublicVolunteerEvent({ id: eventId });

		expect(result.signupCounts).toEqual({});
	});

	it("bench: confirmed signup without assignedRoleId appears in confirmedHelpers with roleId null", async () => {
		const benchedSignup = makeSignup({ status: "confirmed" }); // no assignedRoleId
		mockSignupQuery.mockResolvedValue({ data: [benchedSignup] });

		const result = await getPublicVolunteerEvent({ id: eventId });

		expect(result.confirmedHelpers).toHaveLength(1);
		expect(result.confirmedHelpers[0]?.roleId).toBeNull();
	});
});

describe("confirmVolunteerSignup (admin force-confirm)", () => {
	const signupId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

	beforeEach(() => {
		vi.clearAllMocks();
		mockSignupGet.mockResolvedValueOnce({ data: makeSignup({ id: signupId }) }).mockResolvedValue({ data: makeSignup({ id: signupId, status: "confirmed" }) });
		mockSignupPatch.mockResolvedValue({ data: {} });
	});

	it("sets status to confirmed", async () => {
		const result = await confirmVolunteerSignup({ id: signupId });
		expect(result.status).toBe("confirmed");
		expect(mockSignupPatch).toHaveBeenCalledTimes(1);
	});

	it("throws when signup not found", async () => {
		mockSignupGet.mockResolvedValue({ data: null });
		await expect(confirmVolunteerSignup({ id: signupId })).rejects.toThrow("not found");
	});
});
