import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockAuthenticate = vi.hoisted(() => vi.fn());

const { mockEventGet, mockEventPatch, mockSignupQuery } = vi.hoisted(() => ({
  mockEventGet: vi.fn(),
  mockEventPatch: vi.fn(),
  mockSignupQuery: vi.fn(),
}));

vi.mock("../../api-keys.server", () => ({
  authenticateApiKey: (...args: unknown[]) => mockAuthenticate(...args),
}));

vi.mock("@/lib/db/repositories/content-entities-repository", () => ({
  volunteerEventRepository: {
    getById: mockEventGet,
    create: vi.fn(),
    update: mockEventPatch,
    listAll: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
  },
  volunteerSignupRepository: {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listByEvent: mockSignupQuery,
  },
  volunteerTokenRepository: {
    getById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));

const volunteerEventId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const shiftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const roleId1 = "11111111-1111-4111-8111-111111111111";
const roleId2 = "22222222-2222-4222-8222-222222222222";
const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const mockEvent = {
  id: volunteerEventId,
  type: "volunteerEvent" as const,
  title: "Stadtfest",
  organizerName: "Organizer",
  organizerEmail: "org@example.com",
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

function patchRequest(body: unknown) {
  return new Request(`https://vcmuellheim.de/api/admin/volunteer-events/${volunteerEventId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    },
    body: JSON.stringify(body),
  });
}

describe("updateVolunteerEventApi (repository integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockResolvedValue({
      ok: true,
      apiKey: { id: "key" },
      memberId: "member",
    });
    mockEventGet.mockResolvedValue(mockEvent);
  });

  it("returns 409 when PATCH clears shifts but confirmed signups remain", async () => {
    mockSignupQuery.mockResolvedValue([
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        type: "volunteerSignup",
        status: "confirmed",
        shiftId,
        eventId: volunteerEventId,
        preferredRoleIds: [roleId1],
        firstName: "Erika",
        lastName: "Muster",
        email: "erika@example.com",
        dateOfBirth: "1990-01-01",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const { updateVolunteerEventApi } = await import("./volunteer-events.server");
    const response = await updateVolunteerEventApi(patchRequest({ shifts: [] }), volunteerEventId);

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.reason).toBe("registrations_block_removal");
    expect(mockEventPatch).not.toHaveBeenCalled();
  });

  it("returns 400 for unknown shift ids in PATCH", async () => {
    const { updateVolunteerEventApi } = await import("./volunteer-events.server");
    const response = await updateVolunteerEventApi(
      patchRequest({
        shifts: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            label: "X",
            startDate: futureDate,
            roles: [],
          },
        ],
      }),
      volunteerEventId,
    );

    expect(response.status).toBe(400);
    expect(mockEventPatch).not.toHaveBeenCalled();
  });
});
