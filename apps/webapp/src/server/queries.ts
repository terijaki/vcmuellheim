import { GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { type ClubResponse, ClubResponseSchema, type TeamResponse, TeamResponseSchema } from "@/lambda/sams/types";
import { docClient } from "@/lib/db/client";
import { db } from "@/lib/db/electrodb-client";
import { cmsUserSchema, newsSchema } from "@/lib/db/schemas";
import type { CmsUser, News, PaginationCursor } from "@/lib/db/types";

const SAMS_CLUBS_TABLE_NAME = () => process.env.SAMS_CLUBS_TABLE_NAME || "";
const SAMS_TEAMS_TABLE_NAME = () => process.env.SAMS_TEAMS_TABLE_NAME || "";

type PaginatedResult<T> = {
	items: T[];
	lastEvaluatedKey?: PaginationCursor;
};

// ── Content entity queries (ElectroDB) ────────────────────────────────────────

export async function getAllNews(limit = 100, cursor?: PaginationCursor): Promise<PaginatedResult<News>> {
	const result = await db()
		.news.query.byType({ type: "article" })
		.gt({ updatedAt: "2000-01-01T00:00:00.000Z" })
		.go({ order: "desc", limit, cursor: cursor ?? undefined });
	const items = result.data.map((item) => newsSchema.parse(item));

	return { items, lastEvaluatedKey: result.cursor ?? undefined };
}

export async function getPublishedNews(limit = 10, cursor?: PaginationCursor): Promise<PaginatedResult<News>> {
	const result = await db()
		.news.query.byStatus({ status: "published" })
		.gt({ createdAt: "2000-01-01T00:00:00.000Z" })
		.go({ order: "desc", limit, cursor: cursor ?? undefined });
	const items = result.data.map((item) => newsSchema.parse(item));

	return { items, lastEvaluatedKey: result.cursor ?? undefined };
}

export async function getNewsBySlug(slug: string): Promise<News | null> {
	const result = await db().news.query.bySlug({ slug }).go({ limit: 1 });
	const item = result.data[0] ? newsSchema.parse(result.data[0]) : null;
	return item ?? null;
}

export async function getCmsUserByEmail(email: string): Promise<CmsUser | null> {
	const result = await db().user.query.byEmail({ email }).go({ limit: 1 });
	const item = result.data[0] ? cmsUserSchema.parse(result.data[0]) : null;
	return item ?? null;
}

export async function getAllCmsUsers(): Promise<CmsUser[]> {
	const result = await db().user.query.byType({ type: "user" }).go({ pages: "all" });
	return result.data.map((item) => cmsUserSchema.parse(item));
}

// ── SAMS entity queries (raw DynamoDB — separate SAMS tables) ────────────────

export async function getAllSamsClubs(): Promise<PaginatedResult<ClubResponse>> {
	const result = await docClient.send(
		new ScanCommand({
			TableName: SAMS_CLUBS_TABLE_NAME(),
		}),
	);

	return { items: (result.Items ?? []).map((item) => ClubResponseSchema.parse(item)) };
}

export async function getSamsClubBySportsclubUuid(sportsclubUuid: string): Promise<ClubResponse | null> {
	const result = await docClient.send(
		new GetCommand({
			TableName: SAMS_CLUBS_TABLE_NAME(),
			Key: { sportsclubUuid },
		}),
	);

	return result.Item ? ClubResponseSchema.parse(result.Item) : null;
}

export async function getSamsClubByNameSlug(nameSlug: string): Promise<ClubResponse | null> {
	const result = await docClient.send(
		new QueryCommand({
			TableName: SAMS_CLUBS_TABLE_NAME(),
			IndexName: "GSI-SamsClubQueries",
			KeyConditionExpression: "#type = :type AND #nameSlug = :nameSlug",
			ExpressionAttributeNames: {
				"#type": "type",
				"#nameSlug": "nameSlug",
			},
			ExpressionAttributeValues: {
				":type": "club",
				":nameSlug": nameSlug,
			},
			Limit: 1,
		}),
	);

	return result.Items?.[0] ? ClubResponseSchema.parse(result.Items[0]) : null;
}

export async function getSamsClubByNameSlugPrefix(prefix: string): Promise<ClubResponse | null> {
	const result = await docClient.send(
		new QueryCommand({
			TableName: SAMS_CLUBS_TABLE_NAME(),
			IndexName: "GSI-SamsClubQueries",
			KeyConditionExpression: "#type = :type AND begins_with(#nameSlug, :prefix)",
			ExpressionAttributeNames: {
				"#type": "type",
				"#nameSlug": "nameSlug",
			},
			ExpressionAttributeValues: {
				":type": "club",
				":prefix": prefix,
			},
			Limit: 1,
		}),
	);

	return result.Items?.[0] ? ClubResponseSchema.parse(result.Items[0]) : null;
}

export async function getAllSamsTeams(): Promise<PaginatedResult<TeamResponse>> {
	const result = await docClient.send(
		new ScanCommand({
			TableName: SAMS_TEAMS_TABLE_NAME(),
		}),
	);

	return { items: (result.Items ?? []).map((item) => TeamResponseSchema.parse(item)) };
}

export async function getSamsTeamByUuid(uuid: string): Promise<TeamResponse | null> {
	const result = await docClient.send(
		new GetCommand({
			TableName: SAMS_TEAMS_TABLE_NAME(),
			Key: { uuid },
		}),
	);

	return result.Item ? TeamResponseSchema.parse(result.Item) : null;
}
