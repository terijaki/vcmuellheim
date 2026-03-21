import { beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import type { ClubResponse, TeamResponse } from "@/lambda/sams/types";
import type { CmsUser, News } from "@/lib/db/types";

const ddbMock = mockClient(DynamoDBDocumentClient);

let getAllNews: typeof import("./queries").getAllNews;
let getPublishedNews: typeof import("./queries").getPublishedNews;
let getNewsBySlug: typeof import("./queries").getNewsBySlug;
let getCmsUserByEmail: typeof import("./queries").getCmsUserByEmail;
let getAllCmsUsers: typeof import("./queries").getAllCmsUsers;
let getAllSamsClubs: typeof import("./queries").getAllSamsClubs;
let getSamsClubBySportsclubUuid: typeof import("./queries").getSamsClubBySportsclubUuid;
let getSamsClubByNameSlug: typeof import("./queries").getSamsClubByNameSlug;
let getAllSamsTeams: typeof import("./queries").getAllSamsTeams;
let getSamsTeamByUuid: typeof import("./queries").getSamsTeamByUuid;

describe("server/queries", () => {
	beforeAll(async () => {
		process.env.CONTENT_TABLE_NAME = "test-content-table";
		process.env.SAMS_CLUBS_TABLE_NAME = "test-sams-clubs-table";
		process.env.SAMS_TEAMS_TABLE_NAME = "test-sams-teams-table";

		const q = await import("./queries");
		getAllNews = q.getAllNews;
		getPublishedNews = q.getPublishedNews;
		getNewsBySlug = q.getNewsBySlug;
		getCmsUserByEmail = q.getCmsUserByEmail;
		getAllCmsUsers = q.getAllCmsUsers;
		getAllSamsClubs = q.getAllSamsClubs;
		getSamsClubBySportsclubUuid = q.getSamsClubBySportsclubUuid;
		getSamsClubByNameSlug = q.getSamsClubByNameSlug;
		getAllSamsTeams = q.getAllSamsTeams;
		getSamsTeamByUuid = q.getSamsTeamByUuid;
	});

	beforeEach(() => {
		ddbMock.reset();
	});

	describe("getAllNews", () => {
		it("queries GSI-NewsByType descending with article type", async () => {
			const mockItems = [
				{ id: "1", type: "article", title: "A", slug: "a", content: "c", status: "published", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-02T00:00:00Z" },
				{ id: "2", type: "article", title: "B", slug: "b", content: "c", status: "draft", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
			];
			ddbMock.on(QueryCommand).resolves({ Items: mockItems });

			const result = await getAllNews(10);

			expect(result.items).toHaveLength(2);
			expect(result.items[0].id).toBe("1");

			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls).toHaveLength(1);
			expect(calls[0].args[0].input).toMatchObject({
				TableName: "test-content-table",
				IndexName: "GSI-NewsByType",
				KeyConditionExpression: "#type = :type AND #updatedAt > :minDate",
				ExpressionAttributeValues: { ":type": "article", ":minDate": "2000-01-01T00:00:00.000Z" },
				ScanIndexForward: false,
				Limit: 10,
			});
		});

		it("returns lastEvaluatedKey when present", async () => {
			const lastKey = { id: "x", updatedAt: "2024-01-01T00:00:00Z" };
			ddbMock.on(QueryCommand).resolves({ Items: [], LastEvaluatedKey: lastKey });

			const result = await getAllNews(5);

			expect(result.lastEvaluatedKey).toEqual(lastKey);
		});

		it("passes ExclusiveStartKey for pagination", async () => {
			ddbMock.on(QueryCommand).resolves({ Items: [] });
			const startKey = { id: "abc", updatedAt: "2024-01-01T00:00:00Z" };

			await getAllNews(10, startKey);

			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls[0].args[0].input.ExclusiveStartKey).toEqual(startKey);
		});
	});

	describe("getPublishedNews", () => {
		it("queries GSI-NewsByStatus with status=published", async () => {
			ddbMock.on(QueryCommand).resolves({ Items: [] });

			await getPublishedNews(5);

			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls[0].args[0].input).toMatchObject({
				TableName: "test-content-table",
				IndexName: "GSI-NewsByStatus",
				KeyConditionExpression: "#status = :status AND #createdAt > :minDate",
				ExpressionAttributeValues: { ":status": "published", ":minDate": "2000-01-01T00:00:00.000Z" },
				ScanIndexForward: false,
				Limit: 5,
			});
		});
	});

	describe("getNewsBySlug", () => {
		it("returns first match from GSI-NewsBySlug", async () => {
			const mockArticle: News = { id: "1", type: "article", title: "Hello", slug: "hello", content: "c", status: "published", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" };
			ddbMock.on(QueryCommand).resolves({ Items: [mockArticle] });

			const result = await getNewsBySlug("hello");

			expect(result).toEqual(mockArticle);
			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls[0].args[0].input).toMatchObject({
				IndexName: "GSI-NewsBySlug",
				KeyConditionExpression: "#slug = :slug",
				ExpressionAttributeValues: { ":slug": "hello" },
				Limit: 1,
			});
		});

		it("returns null when not found", async () => {
			ddbMock.on(QueryCommand).resolves({ Items: [] });
			const result = await getNewsBySlug("unknown");
			expect(result).toBeNull();
		});
	});

	describe("getCmsUserByEmail", () => {
		it("queries GSI-UsersByEmail and returns first match", async () => {
			const mockUser: CmsUser = { id: "u1", email: "admin@test.com", name: "Admin", emailVerified: true, role: "Admin", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" };
			ddbMock.on(QueryCommand).resolves({ Items: [mockUser] });

			const result = await getCmsUserByEmail("admin@test.com");

			expect(result).toEqual(mockUser);
			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls[0].args[0].input).toMatchObject({
				TableName: "test-content-table",
				IndexName: "GSI-UsersByEmail",
				KeyConditionExpression: "#email = :email",
				ExpressionAttributeValues: { ":email": "admin@test.com" },
				Limit: 1,
			});
		});

		it("returns null when user not found", async () => {
			ddbMock.on(QueryCommand).resolves({ Items: [] });
			const result = await getCmsUserByEmail("nobody@test.com");
			expect(result).toBeNull();
		});
	});

	describe("getAllCmsUsers", () => {
		it("scans the users table", async () => {
			const mockUsers = [
				{ id: "u1", email: "a@test.com", name: "A", role: "admin", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
				{ id: "u2", email: "b@test.com", name: "B", role: "editor", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
			];
			ddbMock.on(ScanCommand).resolves({ Items: mockUsers });

			const result = await getAllCmsUsers();

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe("u1");
			const calls = ddbMock.commandCalls(ScanCommand);
			expect(calls[0].args[0].input.TableName).toBe("test-content-table");
		});
	});

	describe("getAllSamsClubs", () => {
		it("scans the SAMS clubs table", async () => {
			const mockClubs = [{ sportsclubUuid: "c1", type: "club", nameSlug: "vc-muel" }];
			ddbMock.on(ScanCommand).resolves({ Items: mockClubs });

			const result = await getAllSamsClubs();

			expect(result.items).toHaveLength(1);
			const calls = ddbMock.commandCalls(ScanCommand);
			expect(calls[0].args[0].input.TableName).toBe("test-sams-clubs-table");
		});
	});

	describe("getSamsClubBySportsclubUuid", () => {
		it("gets club by primary key sportsclubUuid", async () => {
			const mockClub: ClubResponse = { sportsclubUuid: "c1", type: "club", name: "VC Müllheim", updatedAt: "2024-01-01T00:00:00Z" };
			ddbMock.on(GetCommand).resolves({ Item: mockClub });

			const result = await getSamsClubBySportsclubUuid("c1");

			expect(result).toEqual(mockClub);
			const calls = ddbMock.commandCalls(GetCommand);
			expect(calls[0].args[0].input).toMatchObject({
				TableName: "test-sams-clubs-table",
				Key: { sportsclubUuid: "c1" },
			});
		});

		it("returns null when not found", async () => {
			ddbMock.on(GetCommand).resolves({ Item: undefined });
			const result = await getSamsClubBySportsclubUuid("missing");
			expect(result).toBeNull();
		});
	});

	describe("getSamsClubByNameSlug", () => {
		it("queries GSI-SamsClubQueries with exact equality match", async () => {
			const mockClub: ClubResponse = { sportsclubUuid: "c1", type: "club", name: "VC Müllheim", updatedAt: "2024-01-01T00:00:00Z" };
			ddbMock.on(QueryCommand).resolves({ Items: [mockClub] });

			const result = await getSamsClubByNameSlug("vc-muellheim");

			expect(result).toEqual(mockClub);
			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls[0].args[0].input).toMatchObject({
				IndexName: "GSI-SamsClubQueries",
				KeyConditionExpression: "#type = :type AND #nameSlug = :nameSlug",
				ExpressionAttributeValues: { ":type": "club", ":nameSlug": "vc-muellheim" },
				Limit: 1,
			});
		});

		it("returns null when no match", async () => {
			ddbMock.on(QueryCommand).resolves({ Items: [] });
			const result = await getSamsClubByNameSlug("unknown");
			expect(result).toBeNull();
		});
	});

	describe("getAllSamsTeams", () => {
		it("scans the SAMS teams table", async () => {
			const mockTeams = [{ uuid: "t1", type: "team", name: "Damen 1" }];
			ddbMock.on(ScanCommand).resolves({ Items: mockTeams });

			const result = await getAllSamsTeams();

			expect(result.items).toHaveLength(1);
			const calls = ddbMock.commandCalls(ScanCommand);
			expect(calls[0].args[0].input.TableName).toBe("test-sams-teams-table");
		});
	});

	describe("getSamsTeamByUuid", () => {
		it("gets team by uuid primary key", async () => {
			const mockTeam: TeamResponse = {
				uuid: "t1",
				type: "team",
				name: "Damen 1",
				sportsclubUuid: "c1",
				associationUuid: "a1",
				leagueUuid: "l1",
				leagueName: "Liga A",
				seasonUuid: "s1",
				seasonName: "2024",
				updatedAt: "2024-01-01T00:00:00Z",
			};
			ddbMock.on(GetCommand).resolves({ Item: mockTeam });

			const result = await getSamsTeamByUuid("t1");

			expect(result).toEqual(mockTeam);
			const calls = ddbMock.commandCalls(GetCommand);
			expect(calls[0].args[0].input).toMatchObject({
				TableName: "test-sams-teams-table",
				Key: { uuid: "t1" },
			});
		});

		it("returns null when not found", async () => {
			ddbMock.on(GetCommand).resolves({ Item: undefined });
			const result = await getSamsTeamByUuid("missing");
			expect(result).toBeNull();
		});
	});
});
