import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { mockGet, mockCreate, mockPatch, mockRebuild } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockCreate: vi.fn(),
  mockPatch: vi.fn(),
  mockRebuild: vi.fn(),
}));

vi.mock("@/lib/db/repositories/news-repository", () => ({
  newsRepository: {
    getById: mockGet,
    create: mockCreate,
    update: (_id: string, updates: unknown) => mockPatch(updates),
  },
}));

vi.mock("@/lib/read-models/public-snapshots", () => ({
  readLatestNews: vi.fn(),
  rebuildLatestNews: (...args: unknown[]) => mockRebuild(...args),
}));

const articleId = "22222222-2222-4222-8222-222222222222";

let createdStatus: string | undefined;
let patchedStatus: string | undefined;

const draft = {
  id: articleId,
  type: "article" as const,
  title: "Sommerfest",
  slug: "sommerfest",
  content: "<p>Hallo</p>",
  status: "draft" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("programmatic news writes", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockCreate.mockReset();
    mockPatch.mockReset();
    mockRebuild.mockReset();
    createdStatus = undefined;
    patchedStatus = undefined;
    mockCreate.mockImplementation((item: { status: string }) => {
      createdStatus = item.status;
      return item;
    });
    mockPatch.mockImplementation((updates: { status?: string }) => {
      patchedStatus = updates.status;
      return { ...draft, ...updates, status: updates.status ?? draft.status };
    });
    mockRebuild.mockResolvedValue({ items: [] });
  });

  it("stores a requested published article as a draft", async () => {
    const { handleCreateDraftNews } = await import("./news.server");
    const created = await handleCreateDraftNews({
      title: "Sommerfest",
      content: "<p>Hallo</p>",
      status: "published",
    });

    expect(created.status).toBe("draft");
    expect(createdStatus).toBe("draft");
    expect(mockRebuild).toHaveBeenCalledTimes(1);
  });

  it("publishes a draft and rebuilds the snapshot", async () => {
    mockGet.mockResolvedValue(draft);
    const { handlePublishNews } = await import("./news.server");

    const result = await handlePublishNews(articleId);

    expect(result?.status).toBe("published");
    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(patchedStatus).toBe("published");
    expect(mockRebuild).toHaveBeenCalledTimes(1);
  });

  it("does not write when the article is already published", async () => {
    mockGet.mockResolvedValue({ ...draft, status: "published" });
    const { handlePublishNews } = await import("./news.server");

    const result = await handlePublishNews(articleId);

    expect(result?.status).toBe("published");
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockRebuild).not.toHaveBeenCalled();
  });

  it("does not write when the article is missing", async () => {
    mockGet.mockResolvedValue(null);
    const { handlePublishNews } = await import("./news.server");

    const result = await handlePublishNews(articleId);

    expect(result).toBeNull();
    expect(mockPatch).not.toHaveBeenCalled();
    expect(mockRebuild).not.toHaveBeenCalled();
  });

  it("publishes an archived article", async () => {
    const archived = { ...draft, status: "archived" as const };
    mockGet.mockResolvedValue(archived);
    const { handlePublishNews } = await import("./news.server");

    const result = await handlePublishNews(articleId);

    expect(result?.status).toBe("published");
    expect(mockPatch).toHaveBeenCalledTimes(1);
  });
});
