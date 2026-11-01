import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const {
  mockAuthenticate,
  mockListEvents,
  mockGetEvent,
  mockListVolunteerEvents,
  mockGetVolunteerEvent,
  mockListBus,
  mockGetBus,
  mockCreateBus,
  mockUpdateBus,
  mockDeleteBus,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockListEvents: vi.fn(),
  mockGetEvent: vi.fn(),
  mockListVolunteerEvents: vi.fn(),
  mockGetVolunteerEvent: vi.fn(),
  mockListBus: vi.fn(),
  mockGetBus: vi.fn(),
  mockCreateBus: vi.fn(),
  mockUpdateBus: vi.fn(),
  mockDeleteBus: vi.fn(),
}));

vi.mock("../api-keys.server", () => ({
  authenticateApiKey: (...args: unknown[]) => mockAuthenticate(...args),
}));

vi.mock("./events.server", () => ({
  handleListAllEvents: (...args: unknown[]) => mockListEvents(...args),
  handleGetEventById: (...args: unknown[]) => mockGetEvent(...args),
}));

vi.mock("./volunteer.server", () => ({
  handleListVolunteerEvents: (...args: unknown[]) => mockListVolunteerEvents(...args),
  handleGetVolunteerEvent: (...args: unknown[]) => mockGetVolunteerEvent(...args),
}));

vi.mock("./bus.server", () => ({
  handleListBus: (...args: unknown[]) => mockListBus(...args),
  handleGetBusById: (...args: unknown[]) => mockGetBus(...args),
  handleCreateBus: (...args: unknown[]) => mockCreateBus(...args),
  handleUpdateBus: (...args: unknown[]) => mockUpdateBus(...args),
  handleDeleteBus: (...args: unknown[]) => mockDeleteBus(...args),
}));

vi.mock("./news.server", () => ({
  handleCreateDraftNews: vi.fn(),
  handlePublishNews: vi.fn(),
  handleGetNewsById: vi.fn(),
  handleListAdminNews: vi.fn(),
  handleUpdateNewsContent: vi.fn(),
  handleDeleteNews: vi.fn(),
}));

vi.mock("./upload.server", () => ({
  handleGetPresignedUrl: vi.fn(),
  handleProcessMediaImage: vi.fn(),
  handleGetFileUrls: vi.fn(),
}));

const eventId = "11111111-1111-4111-8111-111111111111";
const volunteerEventId = "22222222-2222-4222-8222-222222222222";
const busId = "33333333-3333-4333-8333-333333333333";

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

describe("admin CMS HTTP API (events, volunteer events, bus)", () => {
  beforeEach(() => {
    mockAuthenticate.mockReset();
    mockListEvents.mockReset();
    mockGetEvent.mockReset();
    mockListVolunteerEvents.mockReset();
    mockGetVolunteerEvent.mockReset();
    mockListBus.mockReset();
    mockGetBus.mockReset();
    mockCreateBus.mockReset();
    mockUpdateBus.mockReset();
    mockDeleteBus.mockReset();
    mockAuthenticate.mockResolvedValue({
      ok: true,
      apiKey: { id: "key" },
      memberId: "member",
    });
  });

  it("lists events with the events scope", async () => {
    mockListEvents.mockResolvedValue({
      items: [{ id: eventId, title: "Training" }],
    });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request("/api/admin/events", "GET", undefined, "Bearer token"),
    );

    expect(response.status).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalledWith("Bearer token", "events", undefined);
    await expect(response.json()).resolves.toEqual({
      items: [{ id: eventId, title: "Training" }],
    });
  });

  it("returns 404 for a missing event", async () => {
    mockGetEvent.mockResolvedValue(null);
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(`/api/admin/events/${eventId}`, "GET", undefined, "Bearer token"),
    );

    expect(response.status).toBe(404);
    expect(mockAuthenticate).toHaveBeenCalledWith("Bearer token", "events", undefined);
  });

  it("rejects write methods on events", async () => {
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request("/api/admin/events", "POST", { title: "Nope" }, "Bearer token"),
    );

    expect(response.status).toBe(404);
    expect(mockListEvents).not.toHaveBeenCalled();
  });

  it("lists volunteer events with the volunteerEvents scope", async () => {
    mockListVolunteerEvents.mockResolvedValue({
      items: [{ id: volunteerEventId, title: "Helfer" }],
    });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request("/api/admin/volunteer-events", "GET", undefined, "Bearer token"),
    );

    expect(response.status).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalledWith("Bearer token", "volunteerEvents", undefined);
    await expect(response.json()).resolves.toEqual({
      items: [{ id: volunteerEventId, title: "Helfer" }],
    });
  });

  it("returns 404 when a volunteer event is missing", async () => {
    mockGetVolunteerEvent.mockRejectedValue(new Error("Volunteer event not found"));
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(`/api/admin/volunteer-events/${volunteerEventId}`, "GET", undefined, "Bearer token"),
    );

    expect(response.status).toBe(404);
  });

  it("creates a bus booking", async () => {
    const booking = {
      id: busId,
      type: "bus",
      driver: "Alex",
      from: "2030-01-01T10:00:00.000Z",
      to: "2030-01-01T18:00:00.000Z",
      ttl: 1,
      createdAt: "2030-01-01T00:00:00.000Z",
      updatedAt: "2030-01-01T00:00:00.000Z",
    };
    mockCreateBus.mockResolvedValue(booking);
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(
        "/api/admin/bus",
        "POST",
        {
          driver: "Alex",
          from: "2030-01-01T10:00:00.000Z",
          to: "2030-01-01T18:00:00.000Z",
        },
        "Bearer token",
      ),
    );

    expect(response.status).toBe(201);
    expect(mockAuthenticate).toHaveBeenCalledWith("Bearer token", "bus", undefined);
    expect(mockCreateBus).toHaveBeenCalledWith(
      expect.objectContaining({
        driver: "Alex",
        from: "2030-01-01T10:00:00.000Z",
        to: "2030-01-01T18:00:00.000Z",
      }),
    );
    await expect(response.json()).resolves.toEqual(booking);
  });

  it("rejects empty bus updates", async () => {
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(`/api/admin/bus/${busId}`, "PATCH", {}, "Bearer token"),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateBus).not.toHaveBeenCalled();
  });

  it("requires an admin owner to delete a bus booking", async () => {
    mockGetBus.mockResolvedValue({ id: busId, driver: "Alex" });
    mockDeleteBus.mockResolvedValue({ success: true });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(`/api/admin/bus/${busId}`, "DELETE", undefined, "Bearer token"),
    );

    expect(response.status).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalledWith("Bearer token", "bus", { requireAdmin: true });
    expect(mockDeleteBus).toHaveBeenCalledWith(busId);
  });

  it("returns 401 for bus list when the key is missing", async () => {
    mockAuthenticate.mockResolvedValue({
      ok: false,
      status: 401,
      code: "unauthorized",
      reason: "missing_token",
      message: "Authorization header with Bearer API key is required",
    });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(request("/api/admin/bus", "GET"));

    expect(response.status).toBe(401);
    expect(mockListBus).not.toHaveBeenCalled();
  });
});
