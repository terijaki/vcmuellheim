import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "bun:test";
import type { APIGatewayProxyEvent, Context } from "aws-lambda";
import { handler } from "./ics-calendar";

const ddbMock = mockClient(DynamoDBDocumentClient);

// Mock fetch globally
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

// Mock context
const mockContext = {} as Context;

beforeEach(() => {
	ddbMock.reset();
	process.env.TEAMS_TABLE_NAME = "test-teams-table";
	process.env.EVENTS_TABLE_NAME = "test-events-table";
	process.env.SAMS_API_URL = "https://api.example.com";
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

		const result = await handler(event, mockContext, () => {});

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

		const result = await handler(event, mockContext, () => {});

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

		const result = await handler(event, mockContext, () => {});

		expect(result?.statusCode).toBe(404);
		expect(result?.body).toBe("Team nicht gefunden");
	});
});
