import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { TABLES } from "./env";

// Create mock DynamoDB client
const ddbMock = mockClient(DynamoDBDocumentClient);

let getAllNews: typeof import("./repositories").getAllNews;
let getPublishedNews: typeof import("./repositories").getPublishedNews;
let getNewsBySlug: typeof import("./repositories").getNewsBySlug;

describe("News Repository", () => {
	beforeAll(async () => {
		// Set up required environment variables for table names
		for (const table of TABLES) {
			process.env[`${table}_TABLE_NAME`] = `test-${table.toLowerCase()}-table`;
		}
		// Dynamically import after env vars are set
		const repos = await import("./repositories");
		getAllNews = repos.getAllNews;
		getPublishedNews = repos.getPublishedNews;
		getNewsBySlug = repos.getNewsBySlug;
	});

	beforeEach(() => {
		ddbMock.reset();
	});

	describe("getAllNews", () => {
		it("should query GSI-NewsQueries with type=article and sort by updatedAt descending", async () => {
			const mockNews = [
				{
					id: "1",
					type: "article",
					title: "Test News 1",
					slug: "test-news-1",
					content: "Content 1",
					status: "published",
					createdAt: "2024-01-01T00:00:00Z",
					updatedAt: "2024-01-03T00:00:00Z",
				},
				{
					id: "2",
					type: "article",
					title: "Test News 2",
					slug: "test-news-2",
					content: "Content 2",
					status: "draft",
					createdAt: "2024-01-02T00:00:00Z",
					updatedAt: "2024-01-02T00:00:00Z",
				},
			];

			ddbMock.on(QueryCommand).resolves({
				Items: mockNews,
			});

			const result = await getAllNews(10);

			expect(result.items).toHaveLength(2);
			expect(result.items[0].id).toBe("1");
			expect(result.items[1].id).toBe("2");

			// Verify the query was called with correct parameters
			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls).toHaveLength(1);
			expect(calls[0].args[0].input).toMatchObject({
				IndexName: "GSI-NewsQueries",
				KeyConditionExpression: "#type = :type",
				ExpressionAttributeNames: {
					"#type": "type",
				},
				ExpressionAttributeValues: {
					":type": "article",
				},
				ScanIndexForward: false, // Descending order
				Limit: 10,
			});
		});

		it("should include all statuses (draft, published, archived)", async () => {
			const mockNews = [
				{
					id: "1",
					type: "article",
					title: "Published Article",
					slug: "published-article",
					content: "Content",
					status: "published",
					createdAt: "2024-01-01T00:00:00Z",
					updatedAt: "2024-01-03T00:00:00Z",
				},
				{
					id: "2",
					type: "article",
					title: "Draft Article",
					slug: "draft-article",
					content: "Content",
					status: "draft",
					createdAt: "2024-01-02T00:00:00Z",
					updatedAt: "2024-01-02T00:00:00Z",
				},
				{
					id: "3",
					type: "article",
					title: "Archived Article",
					slug: "archived-article",
					content: "Content",
					status: "archived",
					createdAt: "2024-01-03T00:00:00Z",
					updatedAt: "2024-01-01T00:00:00Z",
				},
			];

			ddbMock.on(QueryCommand).resolves({
				Items: mockNews,
			});

			const result = await getAllNews(100);

			expect(result.items).toHaveLength(3);
			expect(result.items.map((item) => item.status)).toEqual(["published", "draft", "archived"]);
		});
	});

	describe("getPublishedNews", () => {
		it("should query GSI-NewsQueries with FilterExpression for status=published", async () => {
			const mockPublishedNews = [
				{
					id: "1",
					type: "article",
					title: "Published News",
					slug: "published-news",
					content: "Content",
					status: "published",
					createdAt: "2024-01-01T00:00:00Z",
					updatedAt: "2024-01-03T00:00:00Z",
				},
			];

			ddbMock.on(QueryCommand).resolves({
				Items: mockPublishedNews,
			});

			const result = await getPublishedNews(10);

			expect(result.items).toHaveLength(1);
			expect(result.items[0].status).toBe("published");

			// Verify the query uses FilterExpression for status
			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls).toHaveLength(1);
			expect(calls[0].args[0].input).toMatchObject({
				IndexName: "GSI-NewsQueries",
				KeyConditionExpression: "#type = :type",
				FilterExpression: "#status = :status",
				ExpressionAttributeNames: {
					"#type": "type",
					"#status": "status",
				},
				ExpressionAttributeValues: {
					":type": "article",
					":status": "published",
				},
				ScanIndexForward: false,
				Limit: 10,
			});
		});

		it("should not return draft or archived articles", async () => {
			const mockNews = [
				{
					id: "1",
					type: "article",
					title: "Published Article",
					slug: "published-article",
					content: "Content",
					status: "published",
					createdAt: "2024-01-01T00:00:00Z",
					updatedAt: "2024-01-03T00:00:00Z",
				},
			];

			ddbMock.on(QueryCommand).resolves({
				Items: mockNews,
			});

			const result = await getPublishedNews(100);

			// Filter would be applied by DynamoDB, so we just verify published items are returned
			expect(result.items).toHaveLength(1);
			expect(result.items.every((item) => item.status === "published")).toBe(true);
		});
	});

	describe("getNewsBySlug", () => {
		it("should query GSI-NewsBySlug with type and slug", async () => {
			const mockNews = {
				id: "1",
				type: "article",
				title: "Test News",
				slug: "test-news",
				content: "Content",
				status: "published",
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-03T00:00:00Z",
			};

			ddbMock.on(QueryCommand).resolves({
				Items: [mockNews],
			});

			const result = await getNewsBySlug("test-news");

			expect(result).not.toBeNull();
			expect(result?.slug).toBe("test-news");

			// Verify the query uses the new GSI-NewsBySlug index
			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls).toHaveLength(1);
			expect(calls[0].args[0].input).toMatchObject({
				IndexName: "GSI-NewsBySlug",
				KeyConditionExpression: "#type = :type AND #slug = :slug",
				ExpressionAttributeNames: {
					"#type": "type",
					"#slug": "slug",
				},
				ExpressionAttributeValues: {
					":type": "article",
					":slug": "test-news",
				},
				Limit: 1,
			});
		});

		it("should return null when no article is found", async () => {
			ddbMock.on(QueryCommand).resolves({
				Items: [],
			});

			const result = await getNewsBySlug("non-existent-slug");

			expect(result).toBeNull();
		});
	});
});
