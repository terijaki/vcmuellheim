import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { handler } from "./ics-calendar";

const ddbMock = mockClient(DynamoDBDocumentClient);

// Default mock fetch
const defaultMockFetch = async (url: string) => {
	if (typeof url === "string" && url.includes("/matches")) {
		return {
			ok: true,
			json: async () => ({
				matches: [
					{
						uuid: "match-123",
						date: "2025-12-15",
						time: "19:00",
						_embedded: {
							team1: { uuid: "team1-uuid", name: "Team A" },
							team2: { uuid: "team2-uuid", name: "Team B" },
						},
						host: "team1-uuid",
						location: {
							name: "Sporthalle",
							address: {
								street: "Sportstraße 1",
								postcode: "79379",
								city: "Müllheim",
							},
						},
					},
				],
				timestamp: new Date().toISOString(),
			}),
		} as Response;
	}
	throw new Error("Unexpected fetch call");
};

// Mock fetch globally
(global as unknown as { fetch: unknown }).fetch = defaultMockFetch;

// Mock context
const mockContext = {} as Context;

beforeEach(() => {
	ddbMock.reset();
	// Reset fetch to default
	(global as unknown as { fetch: unknown }).fetch = defaultMockFetch;
	process.env.TEAMS_TABLE_NAME = "test-teams-table";
	process.env.EVENTS_TABLE_NAME = "test-events-table";
	process.env.SAMS_API_URL = "https://api.example.com";
});

afterEach(() => {
	// Ensure fetch is reset after each test
	(global as unknown as { fetch: unknown }).fetch = defaultMockFetch;
});

describe("ICS Calendar Lambda", () => {
	it("should generate ICS calendar with SAMS matches for 'all' calendar", async () => {
		// Mock custom events query to return empty
		ddbMock.on(QueryCommand).resolves({
			Items: [],
		});

		const event = {
			pathParameters: { teamSlug: "all.ics" },
		} as unknown as APIGatewayProxyEvent;

		const result = await handler(event, mockContext);

		expect(result?.statusCode).toBe(200);
		expect(result?.headers?.["Content-Type"]).toBe("text/calendar; charset=utf-8");
		expect(result?.body).toContain("BEGIN:VCALENDAR");
		expect(result?.body).toContain("Team A vs Team B");
		expect(result?.body).toContain("END:VCALENDAR");
	});

	it("should include custom events from DynamoDB in 'all' calendar", async () => {
		// Mock custom events query
		ddbMock.on(QueryCommand).resolves({
			Items: [
				{
					id: "event-123",
					type: "event",
					title: "Vereinsfest",
					description: "Unser jährliches Vereinsfest",
					startDate: "2025-12-20T18:00:00Z",
					endDate: "2025-12-20T22:00:00Z",
					location: "Vereinsheim",
				},
			],
		});

		const event = {
			pathParameters: { teamSlug: "all.ics" },
		} as unknown as APIGatewayProxyEvent;

		const result = await handler(event, mockContext);

		expect(result?.statusCode).toBe(200);
		expect(result?.body).toContain("Vereinsfest");
		expect(result?.body).toContain("Vereinsheim");
		expect(result?.body).toContain("Unser jährliches Vereinsfest");
	});

	it("should return 404 for non-existent team", async () => {
		ddbMock.on(QueryCommand).resolves({
			Items: [],
		});

		const event = {
			pathParameters: { teamSlug: "non-existent.ics" },
		} as unknown as APIGatewayProxyEvent;

		const result = await handler(event, mockContext);

		expect(result?.statusCode).toBe(404);
		expect(result?.body).toBe("Team nicht gefunden");
	});

	it("should include custom events filtered by teamIds in team-specific calendars", async () => {
		// Reset mocks
		ddbMock.reset();

		let callCount = 0;
		ddbMock.on(QueryCommand).callsFake((_input) => {
			callCount++;
			if (callCount === 1) {
				// First call: team lookup
				return {
					Items: [
						{
							id: "team-123",
							slug: "damen-1",
							name: "Damen 1",
							sbvvTeamId: "sams-team-uuid",
						},
					],
				};
			}
			// Second call: custom events
			return {
				Items: [
					{
						id: "event-456",
						type: "event",
						title: "Team Training",
						startDate: "2025-12-18T19:00:00Z",
						teamIds: ["team-123"],
						location: "Sporthalle",
					},
				],
			};
		});

		const event = {
			pathParameters: { teamSlug: "damen-1.ics" },
		} as unknown as APIGatewayProxyEvent;

		const result = await handler(event, mockContext);

		expect(result?.statusCode).toBe(200);
		// Should contain both SAMS matches and team-specific custom events
		expect(result?.body).toContain("Team A vs Team B");
		expect(result?.body).toContain("Team Training");
		expect(result?.body).toContain("Sporthalle");
	});

	it("should handle fetch errors from SAMS API gracefully", async () => {
		// Replace global fetch to simulate error
		(global as unknown as { fetch: unknown }).fetch = async () => {
			return {
				ok: false,
				statusText: "Internal Server Error",
				status: 500,
			} as Response;
		};

		ddbMock.reset();
		ddbMock.on(QueryCommand).resolves({ Items: [] });

		const event = {
			pathParameters: { teamSlug: "all.ics" },
		} as unknown as APIGatewayProxyEvent;

		const result = await handler(event, mockContext);

		expect(result?.statusCode).toBe(500);
		expect(result?.body).toContain("Problem beim Erzeugen");
	});

	it("should handle invalid date/time combinations and skip them", async () => {
		(global as unknown as { fetch: unknown }).fetch = async (url: string) => {
			if (typeof url === "string" && url.includes("/matches")) {
				return {
					ok: true,
					json: async () => ({
						matches: [
							{
								uuid: "match-valid",
								date: "2025-12-15",
								time: "19:00",
								_embedded: {
									team1: { uuid: "team1", name: "Team A" },
									team2: { uuid: "team2", name: "Team B" },
								},
								host: "team1",
							},
						],
						timestamp: new Date().toISOString(),
					}),
				} as Response;
			}
			throw new Error("Unexpected fetch call");
		};

		ddbMock.reset();
		ddbMock.on(QueryCommand).resolves({ Items: [] });

		const event = {
			pathParameters: { teamSlug: "all.ics" },
		} as unknown as APIGatewayProxyEvent;

		const result = await handler(event, mockContext);

		expect(result?.statusCode).toBe(200);
		expect(result?.body).toContain("BEGIN:VCALENDAR");
		// Should create a valid calendar
	});

	it("should handle matches without embedded team information", async () => {
		(global as unknown as { fetch: unknown }).fetch = async (url: string) => {
			if (typeof url === "string" && url.includes("/matches")) {
				return {
					ok: true,
					json: async () => ({
						matches: [
							{
								uuid: "match-123",
								date: "2025-12-15",
								time: "19:00",
								// No _embedded field
								host: "team1-uuid",
								location: {
									name: "Sporthalle",
								},
							},
						],
						timestamp: new Date().toISOString(),
					}),
				} as Response;
			}
			throw new Error("Unexpected fetch call");
		};

		ddbMock.reset();
		ddbMock.on(QueryCommand).resolves({ Items: [] });

		const event = {
			pathParameters: { teamSlug: "all.ics" },
		} as unknown as APIGatewayProxyEvent;

		const result = await handler(event, mockContext);

		expect(result?.statusCode).toBe(200);
		expect(result?.body).toContain("BEGIN:VCALENDAR");
	});

	it("should handle matches with missing location details", async () => {
		(global as unknown as { fetch: unknown }).fetch = async (url: string) => {
			if (typeof url === "string" && url.includes("/matches")) {
				return {
					ok: true,
					json: async () => ({
						matches: [
							{
								uuid: "match-minimal",
								date: "2025-12-15",
								time: "19:00",
								_embedded: {
									team1: { uuid: "team1", name: "Team A" },
									team2: { uuid: "team2", name: "Team B" },
								},
								// No host or location
							},
						],
						timestamp: new Date().toISOString(),
					}),
				} as Response;
			}
			throw new Error("Unexpected fetch call");
		};

		ddbMock.reset();
		ddbMock.on(QueryCommand).resolves({ Items: [] });

		const event = {
			pathParameters: { teamSlug: "all.ics" },
		} as unknown as APIGatewayProxyEvent;

		const result = await handler(event, mockContext);

		expect(result?.statusCode).toBe(200);
		expect(result?.body).toContain("Team A vs Team B");
	});

	it("should cache calendar with proper headers", async () => {
		ddbMock.reset();
		ddbMock.on(QueryCommand).resolves({ Items: [] });

		const event = {
			pathParameters: { teamSlug: "all.ics" },
		} as unknown as APIGatewayProxyEvent;

		const result = await handler(event, mockContext);

		expect(result?.headers?.["Cache-Control"]).toContain("max-age");
		expect(result?.headers?.["Cache-Control"]).toContain("s-maxage");
		expect(result?.statusCode).toBe(200);
	});
});
