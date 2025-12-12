import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { News } from "@/lib/db/types";

// Mock fetch globally
const mockFetch = mock((_url: string, _init?: RequestInit) =>
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

describe("Mastodon Share Lambda", () => {
	beforeEach(() => {
		mockFetch.mockClear();
	});

	test("should build correct Mastodon status with title and excerpt", async () => {
		const { shareToMastodon } = await import("./mastodon-share");

		const newsArticle: News = {
			id: "test-id",
			type: "article",
			title: "Test News Article",
			slug: "test-news-article",
			content: "<p>Test content</p>",
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
		expect(body.status).toContain("This is a test excerpt for the article");
		expect(body.status).toContain("https://vcmuellheim.de/news/test-news-article");
		expect(body.visibility).toBe("public");
	});

	test("should build Mastodon status without excerpt if not provided", async () => {
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
		expect(body.status).toBe("Test Article Without Excerpt\n\nhttps://vcmuellheim.de/news/test-article-without-excerpt");
	});

	test("should truncate long excerpt to fit 500 character limit", async () => {
		const { shareToMastodon } = await import("./mastodon-share");

		const longExcerpt = "A".repeat(450);
		const newsArticle: News = {
			id: "test-id",
			type: "article",
			title: "Short Title",
			slug: "short-title",
			content: "<p>Test content</p>",
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
		expect(body.status.length).toBeLessThanOrEqual(500);
		expect(body.status).toContain("...");
	});

	test("should throw error if MASTODON_ACCESS_TOKEN is not set", async () => {
		const originalToken = process.env.MASTODON_ACCESS_TOKEN;
		delete process.env.MASTODON_ACCESS_TOKEN;

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

		await expect(
			shareToMastodon({
				newsArticle,
				websiteUrl: "https://vcmuellheim.de",
			}),
		).rejects.toThrow("MASTODON_ACCESS_TOKEN environment variable is not set");

		process.env.MASTODON_ACCESS_TOKEN = originalToken;
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
});
