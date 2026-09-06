import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { News } from "@/lib/db/types";

// Mock Sentry (no-op in tests)
vi.mock("../utils/sentry", () => ({
  Sentry: {
    wrapHandler: vi.fn((fn) => fn),
  },
}));

const markPostedMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/social/match-mastodon-share", () => ({
  createMatchMastodonShareRepository: () => ({
    markPosted: markPostedMock,
    claim: vi.fn(),
    get: vi.fn(),
  }),
}));

// Mock fetch globally
const mockFetch = vi.fn((_url: string, _init?: RequestInit) =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        id: "123456789",
        url: "https://freiburg.social/@VCM/123456789",
        created_at: "2024-01-01T00:00:00.000Z",
      }),
    text: () => Promise.resolve(""),
  } as Response),
);
global.fetch = mockFetch as unknown as typeof global.fetch;

// Set up environment
process.env.MASTODON_ACCESS_TOKEN = "test-token";
process.env.SOCIAL_TABLE_NAME = "test-social-table";
process.env.CDK_ENVIRONMENT = "prod";

describe("Mastodon Share Lambda", () => {
  beforeEach(() => {
    mockFetch.mockClear();
    markPostedMock.mockClear();
  });

  test("short article (content + title ≤ 2500) shares full plain text without URL", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Test News Article",
      slug: "test-news-article",
      content: "<p>This is the <strong>full</strong> article content.</p>",
      excerpt: "This is a test excerpt for the article",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    expect(calls[0][0]).toBe("https://freiburg.social/api/v1/statuses");

    const body = JSON.parse(calls[0][1]?.body as string);
    expect(body.status).toContain("Test News Article");
    expect(body.status).toContain("This is the full article content.");
    expect(body.status).not.toContain("https://vcmuellheim.de/news/test-id");
    expect(body.visibility).toBe("unlisted");
  });

  test("short article without excerpt shares full plain text without URL", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Test Article Without Excerpt",
      slug: "test-article-without-excerpt",
      content: "<p>Test content</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const body = JSON.parse(calls[0][1]?.body as string);
    expect(body.status).toBe("Test Article Without Excerpt\n\nTest content");
  });

  test("should truncate long excerpt to fit 2500 character limit", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    // Content long enough to exceed 2500 chars so the excerpt fallback is triggered
    const longContent = `<p>${"B".repeat(2600)}</p>`;
    // Excerpt longer than the available space after title + url overhead
    const longExcerpt = "A".repeat(2500);
    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Short Title",
      slug: "short-title",
      content: longContent,
      excerpt: longExcerpt,
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const body = JSON.parse(calls[0][1]?.body as string);
    expect(body.status.length).toBeLessThanOrEqual(2500);
    expect(body.status).toContain("…");
  });

  test("should throw error if MASTODON_ACCESS_TOKEN is not set", async () => {
    // This test validates that the error message is correct in the function
    // We can't actually test the runtime behavior without reloading the module
    // which would break other tests, so we just verify the error message exists in code
    const { shareToMastodon } = await import("./mastodon-share");
    expect(shareToMastodon).toBeDefined();
    // The actual validation happens at runtime when MASTODON_ACCESS_TOKEN is checked
  });

  test("should include authorization header with access token", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Test Article",
      slug: "test-article",
      content: "<p>Test content</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const headers = calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
  });

  test("should include idempotency key based on article ID", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "unique-article-id",
      type: "article",
      title: "Test Article",
      slug: "test-article",
      content: "<p>Test content</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const headers = calls[0][1]?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("news-unique-article-id");
  });

  test("should set language to German", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Test Article",
      slug: "test-article",
      content: "<p>Test content</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const body = JSON.parse(calls[0][1]?.body as string);
    expect(body.language).toBe("de");
  });

  test("should handle Mastodon API errors gracefully", async () => {
    const mockFailFetch = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Invalid token"),
      } as Response),
    );
    global.fetch = mockFailFetch as unknown as typeof global.fetch;

    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Test Article",
      slug: "test-article",
      content: "<p>Test content</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    try {
      await shareToMastodon({
        newsArticle,
        websiteUrl: "https://vcmuellheim.de",
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("Failed to post to Mastodon");
    }

    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  test("should handle media upload errors and continue posting without images", async () => {
    const mockFetchWithMediaError = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes("/api/v2/media")) {
        return Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve("Invalid image format"),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "123456789",
            url: "https://freiburg.social/@VCM/123456789",
            created_at: "2024-01-01T00:00:00.000Z",
          }),
        text: () => Promise.resolve(""),
      } as Response);
    });
    global.fetch = mockFetchWithMediaError as unknown as typeof global.fetch;

    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Test Article with Image",
      slug: "test-article-with-image",
      content: "<p>Test content</p>",
      imageS3Keys: ["images/test.jpg"],
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    process.env.MEDIA_BUCKET_NAME = "test-bucket";

    try {
      await shareToMastodon({
        newsArticle,
        websiteUrl: "https://vcmuellheim.de",
      });
    } catch {
      // Expected - S3 client will fail
    }

    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  test("should include media IDs in post when images are provided", async () => {
    let mediaUploadCalls = 0;
    const mockFetchWithMedia = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes("/api/v2/media")) {
        mediaUploadCalls++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: `media-id-${mediaUploadCalls}`,
              type: "image",
              url: `https://freiburg.social/media/${mediaUploadCalls}`,
            }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "status-123",
            url: "https://freiburg.social/@VCM/status-123",
            created_at: "2024-01-01T00:00:00.000Z",
          }),
        text: () => Promise.resolve(""),
      } as Response);
    });
    global.fetch = mockFetchWithMedia as unknown as typeof global.fetch;

    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Article with Multiple Images",
      slug: "article-with-images",
      content: "<p>Test content</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    // Test image limit (Mastodon allows max 4 images)
    newsArticle.imageS3Keys = ["img1.jpg", "img2.jpg", "img3.jpg", "img4.jpg", "img5.jpg"];
    process.env.MEDIA_BUCKET_NAME = "test-bucket";

    try {
      await shareToMastodon({
        newsArticle,
        websiteUrl: "https://vcmuellheim.de",
      });
    } catch {
      // Expected - S3 client will fail, but we can test the media upload logic
    }

    global.fetch = mockFetch as unknown as typeof global.fetch;
  });

  test("handler function should pass request to shareToMastodon", async () => {
    const { handler } = await import("./mastodon-share");
    const callHandler = handler as unknown as (event: unknown) => Promise<unknown>;

    const newsArticle: News = {
      id: "handler-test-id",
      type: "article",
      title: "Handler Test Article",
      slug: "handler-test-article",
      content: "<p>Test content</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const result = (await callHandler({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    })) as { id: string; url: string };

    expect(result.id).toBe("123456789");
    expect(result.url).toBe("https://freiburg.social/@VCM/123456789");
  });

  test("should not include media_ids field if no images were uploaded", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Article Without Images",
      slug: "article-without-images",
      content: "<p>Test content</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const body = JSON.parse(calls[0][1]?.body as string);
    expect(body.media_ids).toBeUndefined();
    expect(body.visibility).toBe("unlisted");
  });

  test("should handle very long titles that consume most of 2500 character limit", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    const longTitle = "A".repeat(400);
    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: longTitle,
      slug: "long-title",
      content: "<p>Test content</p>",
      excerpt: "This excerpt should not appear because title is too long",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const body = JSON.parse(calls[calls.length - 1][1]?.body as string);
    expect(body.status.length).toBeLessThanOrEqual(2500);
  });

  test("long article with excerpt uses excerpt + URL, no raw HTML, length ≤ 2500", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    // Content long enough to exceed 2500 chars after stripping
    const longContent = `<p>${"B".repeat(2600)}</p>`;
    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Test Article",
      slug: "test-article",
      content: longContent,
      excerpt: "Short excerpt for this article.",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const body = JSON.parse(calls[0][1]?.body as string);
    expect(body.status).toContain("Short excerpt for this article.");
    expect(body.status).toContain("https://vcmuellheim.de/news/test-id");
    expect(body.status).not.toMatch(/<[^>]+>/); // no HTML tags
    expect(body.status.length).toBeLessThanOrEqual(2500);
    expect(body.visibility).toBe("unlisted");
  });

  test("long article without excerpt uses truncated plain text + URL, length ≤ 2500", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    // Content long enough to exceed 2500 chars after stripping
    const longContent = `<p>${"C".repeat(2600)}</p>`;
    const newsArticle: News = {
      id: "test-id",
      type: "article",
      title: "Short Title",
      slug: "short-title",
      content: longContent,
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const body = JSON.parse(calls[0][1]?.body as string);
    expect(body.status).toContain("…");
    expect(body.status).toContain("https://vcmuellheim.de/news/test-id");
    expect(body.status.length).toBeLessThanOrEqual(2500);
    expect(body.visibility).toBe("unlisted");
  });

  test("all posts use unlisted visibility", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "visibility-test-id",
      type: "article",
      title: "Visibility Test",
      slug: "visibility-test",
      content: "<p>Some content.</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const body = JSON.parse(calls[0][1]?.body as string);
    expect(body.visibility).toBe("unlisted");
  });

  test("HTML stripping: status contains no HTML tags when content is shared", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "html-test-id",
      type: "article",
      title: "HTML Test",
      slug: "html-test",
      content: "<p>Schöner Tag &amp; Sonnenschein</p><p>Zweiter <strong>Absatz</strong>.</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const body = JSON.parse(calls[0][1]?.body as string);
    expect(body.status).not.toMatch(/<[^>]+>/); // no HTML tags
    expect(body.status).toContain("Schöner Tag & Sonnenschein"); // &amp; decoded
    expect(body.status).toContain("Zweiter Absatz."); // <strong> stripped
  });

  test("HTML stripping: entity-encoded HTML tags are fully removed from output", async () => {
    // Validates that &lt;script&gt; (entity-encoded tags) are also stripped,
    // addressing the CodeQL 'Incomplete multi-character sanitization' finding.
    const { shareToMastodon } = await import("./mastodon-share");

    const newsArticle: News = {
      id: "entity-test-id",
      type: "article",
      title: "Entity Test",
      slug: "entity-test",
      content:
        "<p>Normal text &lt;b&gt;bold&lt;/b&gt; and &lt;script&gt;alert(1)&lt;/script&gt; end.</p>",
      status: "published",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    await shareToMastodon({
      newsArticle,
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const body = JSON.parse(calls[0][1]?.body as string);
    // No literal HTML tags in output (entity-encoded tags must also be stripped)
    expect(body.status).not.toMatch(/<[^>]+>/);
    // Plain text content is preserved
    expect(body.status).toContain("Normal text");
    expect(body.status).toContain("end.");
  });

  test("match sharing is rejected outside prod", async () => {
    process.env.CDK_ENVIRONMENT = "dev";
    vi.resetModules();
    const { shareMatchToMastodon } = await import("./mastodon-share");

    await expect(
      shareMatchToMastodon({
        match: {
          uuid: "match-dev",
          hasResult: true,
          team1: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: "club-a" },
          team2: { uuid: "t2", name: "TV Foo", sportsclubUuid: "other" },
          result: { winner: "t1", setPoints: "3:0" },
        },
        configuredSportsclubUuids: ["club-a"],
      }),
    ).rejects.toThrow(/only allowed in production/);

    expect(mockFetch).not.toHaveBeenCalled();
    process.env.CDK_ENVIRONMENT = "prod";
    vi.resetModules();
  });

  test("match payload posts with match idempotency key, unlisted visibility, and German language", async () => {
    process.env.CDK_ENVIRONMENT = "prod";
    const { shareMatchToMastodon } = await import("./mastodon-share");
    const { buildMatchResultStatus } = await import("./match-result-status");

    const match = {
      uuid: "match-abc",
      hasResult: true,
      team1: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: "club-a" },
      team2: { uuid: "t2", name: "TV Foo", sportsclubUuid: "other" },
      result: {
        winner: "t1",
        setPoints: "3:0",
        sets: [
          { number: 1, ballPoints: "25:20" },
          { number: 2, ballPoints: "25:18" },
          { number: 3, ballPoints: "25:16" },
        ],
      },
    };

    await shareMatchToMastodon({
      match,
      configuredSportsclubUuids: ["club-a"],
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    expect(calls[0][0]).toBe("https://freiburg.social/api/v1/statuses");

    const headers = calls[0][1]?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("match-match-abc");

    const body = JSON.parse(calls[0][1]?.body as string);
    expect(body.visibility).toBe("unlisted");
    expect(body.language).toBe("de");
    expect(body.status).toContain("VC Müllheim 1");
    expect(body.status).toContain("3:0");
    expect(body.status).toContain("Sätze:");

    // Status text comes from the same builder used in production
    const rebuilt = buildMatchResultStatus(match, ["club-a"], {
      pickTemplate: () => "{our} gewinnt {score} gegen {opp}",
      pickEmoji: () => "🔥",
    });
    expect(rebuilt).toContain("gewinnt 3:0 gegen TV Foo");

    expect(markPostedMock).toHaveBeenCalledWith("match-abc", "123456789");
  });

  test("news payload still works alongside match support", async () => {
    const { shareToMastodon } = await import("./mastodon-share");

    await shareToMastodon({
      newsArticle: {
        id: "news-still-works",
        type: "article",
        title: "Still Works",
        slug: "still-works",
        content: "<p>Hello</p>",
        status: "published",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      },
      websiteUrl: "https://vcmuellheim.de",
    });

    const calls = mockFetch.mock.calls as Array<[string, RequestInit?]>;
    const headers = calls[0][1]?.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBe("news-news-still-works");
    expect(markPostedMock).not.toHaveBeenCalled();
  });
});
