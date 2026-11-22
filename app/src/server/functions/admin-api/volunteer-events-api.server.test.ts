import samplePayload from "./fixtures/volunteer-event-sample-payload.json";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const {
  mockAuthenticate,
  mockGetVolunteerEvent,
  mockCreateVolunteerEvent,
  mockUpdateVolunteerEvent,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockGetVolunteerEvent: vi.fn(),
  mockCreateVolunteerEvent: vi.fn(),
  mockUpdateVolunteerEvent: vi.fn(),
}));

vi.mock("../../api-keys.server", () => ({
  authenticateApiKey: (...args: unknown[]) => mockAuthenticate(...args),
}));

vi.mock("../volunteer.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../volunteer.server")>();
  return {
    ...actual,
    handleGetVolunteerEvent: (...args: unknown[]) => mockGetVolunteerEvent(...args),
    handleCreateVolunteerEvent: (...args: unknown[]) => mockCreateVolunteerEvent(...args),
    handleUpdateVolunteerEvent: (...args: unknown[]) => mockUpdateVolunteerEvent(...args),
    handleListVolunteerSignups: vi.fn(),
  };
});

const volunteerEventId = "22222222-2222-4222-8222-222222222222";

function request(path: string, method: string, body?: unknown, authorization?: string) {
  return new Request(`https://vcmuellheim.de${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("volunteer events CMS HTTP API (write)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticate.mockResolvedValue({
      ok: true,
      apiKey: { id: "key" },
      memberId: "member",
    });
  });

  it("rejects create without authorization", async () => {
    mockAuthenticate.mockResolvedValue({
      ok: false,
      status: 401,
      code: "unauthorized",
      reason: "missing_token",
      message: "Authorization header with Bearer API key is required",
    });
    const { createVolunteerEventApi } = await import("./volunteer-events.server");
    const response = await createVolunteerEventApi(
      request("/api/admin/volunteer-events", "POST", { title: "x" }),
    );
    expect(response.status).toBe(401);
    expect(mockCreateVolunteerEvent).not.toHaveBeenCalled();
  });

  it("rejects create when the key lacks volunteerEvents scope", async () => {
    mockAuthenticate.mockResolvedValue({
      ok: false,
      status: 403,
      code: "forbidden",
      reason: "wrong_scope",
      message: 'API key scopes [bus] do not allow this action (required: "volunteerEvents")',
    });
    const { createVolunteerEventApi } = await import("./volunteer-events.server");
    const response = await createVolunteerEventApi(
      request("/api/admin/volunteer-events", "POST", samplePayload, "Bearer token"),
    );
    expect(response.status).toBe(403);
    expect(mockAuthenticate).toHaveBeenCalledWith("Bearer token", "volunteerEvents", undefined);
    expect(mockCreateVolunteerEvent).not.toHaveBeenCalled();
  });

  it("allows create for a moderator key with volunteerEvents scope", async () => {
    const createdEvent = { id: volunteerEventId, title: samplePayload.title, shifts: [] };
    mockCreateVolunteerEvent.mockResolvedValue(createdEvent);

    const { createVolunteerEventApi } = await import("./volunteer-events.server");
    const response = await createVolunteerEventApi(
      request("/api/admin/volunteer-events", "POST", samplePayload, "Bearer mod-token"),
    );

    expect(response.status).toBe(201);
    expect(mockAuthenticate).toHaveBeenCalledWith("Bearer mod-token", "volunteerEvents", undefined);
    expect(mockCreateVolunteerEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        title: samplePayload.title,
        shifts: expect.any(Array),
      }),
    );
    const createArg = mockCreateVolunteerEvent.mock.calls[0]?.[0] as { shifts: { id: string }[] };
    expect(createArg.shifts).toHaveLength(10);
    await expect(response.json()).resolves.toEqual(createdEvent);
  });

  it("validates create request body", async () => {
    const { createVolunteerEventApi } = await import("./volunteer-events.server");
    const response = await createVolunteerEventApi(
      request("/api/admin/volunteer-events", "POST", { title: "" }, "Bearer token"),
    );
    expect(response.status).toBe(400);
    expect(mockCreateVolunteerEvent).not.toHaveBeenCalled();
  });

  it("patches volunteer event fields", async () => {
    const updated = { id: volunteerEventId, title: "Neu", shifts: [] };
    mockGetVolunteerEvent.mockResolvedValue({ id: volunteerEventId, title: "Alt", shifts: [] });
    mockUpdateVolunteerEvent.mockResolvedValue(updated);

    const { updateVolunteerEventApi } = await import("./volunteer-events.server");
    const response = await updateVolunteerEventApi(
      request(
        `/api/admin/volunteer-events/${volunteerEventId}`,
        "PATCH",
        { title: "Neu" },
        "Bearer token",
      ),
      volunteerEventId,
    );

    expect(response.status).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalledWith("Bearer token", "volunteerEvents", undefined);
    expect(mockUpdateVolunteerEvent).toHaveBeenCalledWith(volunteerEventId, { title: "Neu" });
    await expect(response.json()).resolves.toEqual(updated);
  });

  it("returns 404 when patching an unknown event id", async () => {
    mockGetVolunteerEvent.mockRejectedValue(new Error("Volunteer event not found"));

    const { updateVolunteerEventApi } = await import("./volunteer-events.server");
    const response = await updateVolunteerEventApi(
      request(
        `/api/admin/volunteer-events/${volunteerEventId}`,
        "PATCH",
        { title: "Neu" },
        "Bearer token",
      ),
      volunteerEventId,
    );

    expect(response.status).toBe(404);
    expect(mockUpdateVolunteerEvent).not.toHaveBeenCalled();
  });

  it("rejects empty patch bodies", async () => {
    mockGetVolunteerEvent.mockResolvedValue({ id: volunteerEventId, title: "Alt", shifts: [] });
    const { updateVolunteerEventApi } = await import("./volunteer-events.server");
    const response = await updateVolunteerEventApi(
      request(`/api/admin/volunteer-events/${volunteerEventId}`, "PATCH", {}, "Bearer token"),
      volunteerEventId,
    );
    expect(response.status).toBe(400);
    expect(mockUpdateVolunteerEvent).not.toHaveBeenCalled();
  });

  it("returns 409 when shift update conflicts with registrations", async () => {
    const { VolunteerEventUpdateConflictError } = await import("../volunteer.server");
    mockGetVolunteerEvent.mockResolvedValue({ id: volunteerEventId, title: "Alt", shifts: [] });
    mockUpdateVolunteerEvent.mockRejectedValue(
      new VolunteerEventUpdateConflictError(
        "Cannot remove shifts or roles that have active registrations",
        {
          shiftIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
          roleIds: [],
        },
      ),
    );

    const { updateVolunteerEventApi } = await import("./volunteer-events.server");
    const response = await updateVolunteerEventApi(
      request(
        `/api/admin/volunteer-events/${volunteerEventId}`,
        "PATCH",
        { shifts: [] },
        "Bearer token",
      ),
      volunteerEventId,
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("conflict");
    expect(body.error.reason).toBe("registrations_block_removal");
  });
});
