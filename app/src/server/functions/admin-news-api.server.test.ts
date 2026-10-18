import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const {
  mockAuthenticate,
  mockCreateDraft,
  mockPublish,
  mockGetById,
  mockList,
  mockUpdateContent,
  mockPresign,
  mockProcessImage,
  mockGetFileUrls,
} = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(),
  mockCreateDraft: vi.fn(),
  mockPublish: vi.fn(),
  mockGetById: vi.fn(),
  mockList: vi.fn(),
  mockUpdateContent: vi.fn(),
  mockPresign: vi.fn(),
  mockProcessImage: vi.fn(),
  mockGetFileUrls: vi.fn(),
}));

vi.mock("../api-keys.server", () => ({
  authenticateApiKey: (...args: unknown[]) => mockAuthenticate(...args),
}));

vi.mock("./news.server", () => ({
  handleCreateDraftNews: (...args: unknown[]) => mockCreateDraft(...args),
  handlePublishNews: (...args: unknown[]) => mockPublish(...args),
  handleGetNewsById: (...args: unknown[]) => mockGetById(...args),
  handleListAdminNews: (...args: unknown[]) => mockList(...args),
  handleUpdateNewsContent: (...args: unknown[]) => mockUpdateContent(...args),
}));

vi.mock("./upload.server", () => ({
  handleGetPresignedUrl: (...args: unknown[]) => mockPresign(...args),
  handleProcessMediaImage: (...args: unknown[]) => mockProcessImage(...args),
  handleGetFileUrls: (...args: unknown[]) => mockGetFileUrls(...args),
}));

const articleId = "33333333-3333-4333-8333-333333333333";
const publicOrigin = (process.env.APP_BASE_URL ?? "https://vcmuellheim.de").replace(/\/+$/, "");

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
    expect(body.servers[0].url).toBe(publicOrigin);
  });

  beforeEach(() => {
    mockAuthenticate.mockReset();
    mockCreateDraft.mockReset();
    mockPublish.mockReset();
    mockGetById.mockReset();
    mockList.mockReset();
    mockUpdateContent.mockReset();
    mockPresign.mockReset();
    mockProcessImage.mockReset();
    mockGetFileUrls.mockReset();
    mockGetFileUrls.mockImplementation(async (keys: string[]) =>
      keys.map((key) => `https://media.test/${key}`),
    );
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

  it("creates a draft when status is omitted", async () => {
    mockCreateDraft.mockResolvedValue({ id: articleId, status: "draft", title: "A" });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request("/api/admin/news", "POST", { title: "A", content: "<p>B</p>" }, "Bearer token"),
    );

    expect(response.status).toBe(201);
    expect(mockCreateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ title: "A", status: "draft" }),
    );
  });

  it("rejects status on create with a field-specific error", async () => {
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(
        "/api/admin/news",
        "POST",
        { title: "A", content: "<p>B</p>", status: "published" },
        "Bearer token",
      ),
    );

    expect(response.status).toBe(400);
    expect(mockCreateDraft).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid",
        details: [{ path: "status" }],
      },
    });
  });

  it("uses APP_BASE_URL for OpenAPI servers instead of the request host", async () => {
    const previous = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = "https://www.vcmuellheim.de";
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      new Request("https://abc123.lambda-url.eu-central-1.on.aws/api/admin/openapi.json"),
    );
    if (previous === undefined) {
      Reflect.deleteProperty(process.env, "APP_BASE_URL");
    } else {
      process.env.APP_BASE_URL = previous;
    }

    const body = await response.json();
    expect(body.servers[0].url).toBe("https://www.vcmuellheim.de");
  });

  it("includes publicUrl when reading a single article", async () => {
    mockGetById.mockResolvedValue({
      id: articleId,
      status: "draft",
      title: "A",
      imageS3Keys: ["news/photo.jpg"],
    });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(`/api/admin/news/${articleId}`, "GET", undefined, "Bearer token"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      publicUrl: `${publicOrigin}/news/${articleId}`,
      imageUrls: ["https://media.test/news/photo.jpg"],
    });
  });

  it("patches content through the update handler", async () => {
    mockUpdateContent.mockResolvedValue({ id: articleId, status: "draft", title: "Updated" });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(`/api/admin/news/${articleId}`, "PATCH", { title: "Updated" }, "Bearer token"),
    );

    expect(response.status).toBe(200);
    expect(mockUpdateContent).toHaveBeenCalledWith(articleId, { title: "Updated" });
    await expect(response.json()).resolves.toMatchObject({
      title: "Updated",
      publicUrl: `${publicOrigin}/news/${articleId}`,
    });
  });

  it("returns 400 for an empty PATCH body", async () => {
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(`/api/admin/news/${articleId}`, "PATCH", {}, "Bearer token"),
    );

    expect(response.status).toBe(400);
    expect(mockUpdateContent).not.toHaveBeenCalled();
  });

  it("returns 404 from PATCH when the article does not exist", async () => {
    mockUpdateContent.mockResolvedValue(null);
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(`/api/admin/news/${articleId}`, "PATCH", { title: "X" }, "Bearer token"),
    );

    expect(response.status).toBe(404);
  });

  it("rejects invalid imageS3Keys on create", async () => {
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(
        "/api/admin/news",
        "POST",
        { title: "A", content: "<p>B</p>", imageS3Keys: ["members/x.jpg"] },
        "Bearer token",
      ),
    );

    expect(response.status).toBe(400);
    expect(mockCreateDraft).not.toHaveBeenCalled();
  });

  it("returns presigned upload URL for news images", async () => {
    mockPresign.mockResolvedValue({
      uploadUrl: "https://s3.example/upload",
      key: "news/abc.jpg",
      bucket: "media",
    });
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request(
        "/api/admin/media/upload-url",
        "POST",
        { filename: "photo.jpg", contentType: "image/jpeg" },
        "Bearer token",
      ),
    );

    expect(response.status).toBe(200);
    expect(mockPresign).toHaveBeenCalledWith({
      filename: "photo.jpg",
      contentType: "image/jpeg",
      folder: "news",
    });
    await expect(response.json()).resolves.toEqual({
      uploadUrl: "https://s3.example/upload",
      key: "news/abc.jpg",
      expiresIn: 300,
    });
  });

  it("processes a news gallery key", async () => {
    mockProcessImage.mockResolvedValue(undefined);
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request("/api/admin/media/process", "POST", { s3Key: "news/abc.jpg" }, "Bearer token"),
    );

    expect(response.status).toBe(200);
    expect(mockProcessImage).toHaveBeenCalledWith("news/abc.jpg");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("rejects process for keys outside news/", async () => {
    const { handleAdminApiRequest } = await import("./admin-news-api.server");
    const response = await handleAdminApiRequest(
      request("/api/admin/media/process", "POST", { s3Key: "teams/logo.jpg" }, "Bearer token"),
    );

    expect(response.status).toBe(400);
    expect(mockProcessImage).not.toHaveBeenCalled();
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
