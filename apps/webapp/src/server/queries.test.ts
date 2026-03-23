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
		it("queries GSI1-ByTypeAndDate descending via ElectroDB", async () => {
			// ElectroDB requires __edb_e__ and __edb_v__ to correctly parse query results
			const mockItems = [
				{
					id: "11111111-1111-4111-8111-111111111111",
					type: "article",
					title: "A",
					slug: "a",
					content: "c",
					status: "published",
					createdAt: "2024-01-01T00:00:00Z",
					updatedAt: "2024-01-02T00:00:00Z",
					__edb_e__: "news",
					__edb_v__: "1",
				},
				{
					id: "22222222-2222-4222-8222-222222222222",
					type: "article",
					title: "B",
					slug: "b",
					content: "c",
					status: "draft",
					createdAt: "2024-01-01T00:00:00Z",
					updatedAt: "2024-01-01T00:00:00Z",
					__edb_e__: "news",
					__edb_v__: "1",
				},
			];
			ddbMock.on(QueryCommand).resolves({ Items: mockItems });

			const result = await getAllNews(10);

			expect(result.items).toHaveLength(2);
			expect(result.items[0].id).toBe("11111111-1111-4111-8111-111111111111");

			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls).toHaveLength(1);
			expect(calls[0].args[0].input).toMatchObject({
				TableName: "test-content-table",
				IndexName: "GSI1-ByTypeAndDate",
				ScanIndexForward: false,
				Limit: 10,
			});
		});

		it("returns lastEvaluatedKey (ElectroDB cursor string) when present", async () => {
			const lastKey = { gsi1pk: "$vcm#type_article", gsi1sk: "$news_1#updatedat_2024-01-01t00:00:00z", pk: "$vcm#id_x", sk: "$news_1" };
			ddbMock.on(QueryCommand).resolves({ Items: [], LastEvaluatedKey: lastKey });

			const result = await getAllNews(5);

			// ElectroDB encodes LastEvaluatedKey as a base64 cursor string
			expect(result.lastEvaluatedKey).toBeString();
			expect(result.lastEvaluatedKey).toBeTruthy();
		});

		it("forwards cursor as ExclusiveStartKey when provided", async () => {
			ddbMock.on(QueryCommand).resolves({ Items: [] });
			// Simulate an ElectroDB cursor (base64-encoded DynamoDB key)
			const cursor = Buffer.from(JSON.stringify({ pk: "$vcm#id_abc", sk: "$news_1" })).toString("base64");

			await getAllNews(10, cursor);

			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls[0].args[0].input.ExclusiveStartKey).toBeDefined();
		});
	});

	describe("getPublishedNews", () => {
		it("queries GSI2-ByStatus with status=published via ElectroDB", async () => {
			ddbMock.on(QueryCommand).resolves({ Items: [] });

			await getPublishedNews(5);

			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls[0].args[0].input).toMatchObject({
				TableName: "test-content-table",
				IndexName: "GSI2-ByStatus",
				ScanIndexForward: false,
				Limit: 5,
			});
		});
	});

	describe("getNewsBySlug", () => {
		it("returns first match from GSI3-BySlug via ElectroDB", async () => {
			const domainItem: News = {
				id: "33333333-3333-4333-8333-333333333333",
				type: "article",
				title: "Hello",
				slug: "hello",
				content: "c",
				status: "published",
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
			};
			// Include ElectroDB internal fields so it can parse the result correctly
			const dbItem = { ...domainItem, __edb_e__: "news", __edb_v__: "1" };
			ddbMock.on(QueryCommand).resolves({ Items: [dbItem] });

			const result = await getNewsBySlug("hello");

			// ElectroDB strips internal fields from the result
			expect(result).toEqual(domainItem);
			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls[0].args[0].input).toMatchObject({
				TableName: "test-content-table",
				IndexName: "GSI3-BySlug",
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
		it("queries GSI4-ByIdentifier by email via ElectroDB", async () => {
			const domainUser: CmsUser = {
				id: "44444444-4444-4444-8444-444444444444",
				type: "user",
				email: "admin@test.com",
				name: "Admin",
				emailVerified: true,
				role: "Admin",
				createdAt: "2024-01-01T00:00:00Z",
				updatedAt: "2024-01-01T00:00:00Z",
			};
			const dbItem = { ...domainUser, __edb_e__: "user", __edb_v__: "1" };
			ddbMock.on(QueryCommand).resolves({ Items: [dbItem] });

			const result = await getCmsUserByEmail("admin@test.com");

			expect(result).toEqual(domainUser);
			const calls = ddbMock.commandCalls(QueryCommand);
			expect(calls[0].args[0].input).toMatchObject({
				TableName: "test-content-table",
				IndexName: "GSI4-ByIdentifier",
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
		it("queries the content table by type index for users", async () => {
			const mockUsers = [
				{
					id: "55555555-5555-4555-8555-555555555555",
					email: "a@test.com",
					name: "A",
					role: "Admin",
					emailVerified: true,
					createdAt: "2024-01-01T00:00:00Z",
					updatedAt: "2024-01-01T00:00:00Z",
					type: "user",
					__edb_e__: "user",
					__edb_v__: "1",
				},
				{
					id: "66666666-6666-4666-8666-666666666666",
					email: "b@test.com",
					name: "B",
					role: "Moderator",
					emailVerified: false,
					createdAt: "2024-01-01T00:00:00Z",
					updatedAt: "2024-01-01T00:00:00Z",
					type: "user",
					__edb_e__: "user",
					__edb_v__: "1",
				},
			];
			ddbMock.on(QueryCommand).resolves({ Items: mockUsers });

			const result = await getAllCmsUsers();

			expect(result).toHaveLength(2);
			expect(result[0].id).toBe("55555555-5555-4555-8555-555555555555");
			const calls = ddbMock.commandCalls(QueryCommand);
			const userQueryCall = calls.find((c) => c.args[0].input.IndexName === "GSI1-ByTypeAndDate");
			expect(userQueryCall).toBeDefined();
			expect(userQueryCall?.args[0].input.TableName).toBe("test-content-table");
		});
	});

	describe("getAllSamsClubs", () => {
		it("scans the SAMS clubs table", async () => {
			const mockClubs = [
				{
					sportsclubUuid: "c1",
					type: "club",
					name: "VC M\u00fcllheim",
					associationUuid: null,
					associationName: null,
					logoImageLink: null,
					logoS3Key: null,
					updatedAt: "2024-01-01T00:00:00Z",
					nameSlug: "vc-muel",
					ttl: 123,
				},
			];
			ddbMock.on(ScanCommand).resolves({ Items: mockClubs });

			const result = await getAllSamsClubs();

			expect(result.items).toHaveLength(1);
			const calls = ddbMock.commandCalls(ScanCommand);
			expect(calls[0].args[0].input.TableName).toBe("test-sams-clubs-table");
		});
	});

	describe("getSamsClubBySportsclubUuid", () => {
		it("gets club by primary key sportsclubUuid", async () => {
			const mockClub: ClubResponse = { sportsclubUuid: "c1", type: "club", name: "VC M\u00fcllheim", updatedAt: "2024-01-01T00:00:00Z" };
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
			const mockClub: ClubResponse = { sportsclubUuid: "c1", type: "club", name: "VC M\u00fcllheim", updatedAt: "2024-01-01T00:00:00Z" };
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
			const mockTeams = [
				{
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
					nameSlug: "damen-1",
					ttl: 123,
				},
			];
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
