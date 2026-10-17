import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { mockAuthenticate, mockCreateDraft, mockPublish, mockGetById, mockList } = vi.hoisted(
  () => ({
    mockAuthenticate: vi.fn(),
    mockCreateDraft: vi.fn(),
    mockPublish: vi.fn(),
    mockGetById: vi.fn(),
    mockList: vi.fn(),
  }),
);

vi.mock("../api-keys.server", () => ({
  authenticateApiKey: (...args: unknown[]) => mockAuthenticate(...args),
}));

vi.mock("./news.server", () => ({
  handleCreateDraftNews: (...args: unknown[]) => mockCreateDraft(...args),
  handlePublishNews: (...args: unknown[]) => mockPublish(...args),
  handleGetNewsById: (...args: unknown[]) => mockGetById(...args),
  handleListAdminNews: (...args: unknown[]) => mockList(...args),
}));

const articleId = "33333333-3333-4333-8333-333333333333";

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

describe("admin news HTTP API", () => {
  it("serves the OpenAPI document without authentication", async () => {
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      new Request("https://dev.new.vcmuellheim.de/api/admin/openapi.json"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("public");
    expect(mockAuthenticate).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.servers[0].url).toBe("https://dev.new.vcmuellheim.de");
  });

  beforeEach(() => {
    mockAuthenticate.mockReset();
    mockCreateDraft.mockReset();
    mockPublish.mockReset();
    mockGetById.mockReset();
    mockList.mockReset();
    mockAuthenticate.mockResolvedValue({
      ok: true,
      apiKey: { id: "key" },
      memberId: "member",
    });
  });

  it("returns 401 and does not write when the key is missing", async () => {
    mockAuthenticate.mockResolvedValue({
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Unauthorized",
    });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request("/api/admin/news", "POST", { title: "A", content: "B", status: "published" }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockCreateDraft).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: { code: "unauthorized", message: "Unauthorized" },
    });
  });

  it("returns 403 and does not write when the key is forbidden", async () => {
    mockAuthenticate.mockResolvedValue({
      ok: false,
      status: 403,
      code: "forbidden",
      message: "Forbidden",
    });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request("/api/admin/news/" + articleId + "/publish", "POST", undefined, "Bearer token"),
    );

    expect(response.status).toBe(403);
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing article without creating or publishing", async () => {
    mockGetById.mockResolvedValue(null);
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(`/api/admin/news/${articleId}`, "GET", undefined, "Bearer token"),
    );

    expect(response.status).toBe(404);
    expect(mockCreateDraft).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it("creates through the draft handler even when the body asks to publish", async () => {
    mockCreateDraft.mockResolvedValue({ id: articleId, status: "draft", title: "A" });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(
        "/api/admin/news",
        "POST",
        { title: "A", content: "<p>B</p>", status: "published" },
        "Bearer token",
      ),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mockCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ title: "A", status: "published" }),
    );
  });

  it("returns 404 from publish when the article does not exist", async () => {
    mockPublish.mockResolvedValue(null);
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(`/api/admin/news/${articleId}/publish`, "POST", undefined, "Bearer token"),
    );

    expect(response.status).toBe(404);
    expect(mockCreateDraft).not.toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith(articleId);
  });
});
