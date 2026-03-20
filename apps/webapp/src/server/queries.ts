import { GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { ClubResponse, TeamResponse } from "@/lambda/sams/types";
import { docClient, getTableName } from "@/lib/db/client";
import type { CmsUser, News, PaginationCursor } from "@/lib/db/types";

const NEWS_TABLE_NAME = () => getTableName("NEWS");
const USERS_TABLE_NAME = () => getTableName("USERS");
const SAMS_CLUBS_TABLE_NAME = () => process.env.SAMS_CLUBS_TABLE_NAME || "";
const SAMS_TEAMS_TABLE_NAME = () => process.env.SAMS_TEAMS_TABLE_NAME || "";

type PaginatedResult<T> = {
	items: T[];
	lastEvaluatedKey?: PaginationCursor;
};

function toPaginatedResult<T>(items: T[] | undefined, lastEvaluatedKey: Record<string, unknown> | undefined): PaginatedResult<T> {
	return {
		items: items || [],
		lastEvaluatedKey: lastEvaluatedKey as PaginationCursor | undefined,
	};
}

export async function getAllNews(limit = 100, startKey?: PaginationCursor): Promise<PaginatedResult<News>> {
	const result = await docClient.send(
		new QueryCommand({
			TableName: NEWS_TABLE_NAME(),
			IndexName: "GSI-NewsByType",
			// Keep CMS news list on updatedAt until GSI-NewsByType is migrated in a later deployment. Then switch to createdAt for better consistency.
			KeyConditionExpression: "#type = :type AND #updatedAt > :minDate",
			ExpressionAttributeNames: {
				"#type": "type",
				"#updatedAt": "updatedAt",
			},
			ExpressionAttributeValues: {
				":type": "article",
				":minDate": "2000-01-01T00:00:00.000Z",
			},
			ScanIndexForward: false,
			Limit: limit,
			ExclusiveStartKey: startKey,
		}),
	);

	return toPaginatedResult(result.Items as News[] | undefined, result.LastEvaluatedKey as Record<string, unknown> | undefined);
}

export async function getPublishedNews(limit = 10, startKey?: PaginationCursor): Promise<PaginatedResult<News>> {
	const result = await docClient.send(
		new QueryCommand({
			TableName: NEWS_TABLE_NAME(),
			IndexName: "GSI-NewsByStatus",
			KeyConditionExpression: "#status = :status AND #createdAt > :minDate",
			ExpressionAttributeNames: {
				"#status": "status",
				"#createdAt": "createdAt",
			},
			ExpressionAttributeValues: {
				":status": "published",
				":minDate": "2000-01-01T00:00:00.000Z",
			},
			ScanIndexForward: false,
			Limit: limit,
			ExclusiveStartKey: startKey,
		}),
	);

	return toPaginatedResult(result.Items as News[] | undefined, result.LastEvaluatedKey as Record<string, unknown> | undefined);
}

export async function getNewsBySlug(slug: string): Promise<News | null> {
	const result = await docClient.send(
		new QueryCommand({
			TableName: NEWS_TABLE_NAME(),
			IndexName: "GSI-NewsBySlug",
			KeyConditionExpression: "#slug = :slug",
			ExpressionAttributeNames: {
				"#slug": "slug",
			},
			ExpressionAttributeValues: {
				":slug": slug,
			},
			Limit: 1,
		}),
	);

	return (result.Items?.[0] as News | undefined) ?? null;
}

export async function getCmsUserByEmail(email: string): Promise<CmsUser | null> {
	const result = await docClient.send(
		new QueryCommand({
			TableName: USERS_TABLE_NAME(),
			IndexName: "GSI-UsersByEmail",
			KeyConditionExpression: "#email = :email",
			ExpressionAttributeNames: { "#email": "email" },
			ExpressionAttributeValues: { ":email": email },
			Limit: 1,
		}),
	);

	return (result.Items?.[0] as CmsUser | undefined) ?? null;
}

export async function getAllCmsUsers(): Promise<CmsUser[]> {
	const result = await docClient.send(
		new ScanCommand({
			TableName: USERS_TABLE_NAME(),
		}),
	);

	return (result.Items as CmsUser[] | undefined) || [];
}

export async function getAllSamsClubs(): Promise<PaginatedResult<ClubResponse>> {
	const result = await docClient.send(
		new ScanCommand({
			TableName: SAMS_CLUBS_TABLE_NAME(),
		}),
	);

	return toPaginatedResult(result.Items as ClubResponse[] | undefined, result.LastEvaluatedKey as Record<string, unknown> | undefined);
}

export async function getSamsClubBySportsclubUuid(sportsclubUuid: string): Promise<ClubResponse | null> {
	const result = await docClient.send(
		new GetCommand({
			TableName: SAMS_CLUBS_TABLE_NAME(),
			Key: { sportsclubUuid },
		}),
	);

	return (result.Item as ClubResponse | undefined) ?? null;
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

	return (result.Items?.[0] as ClubResponse | undefined) ?? null;
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

	return (result.Items?.[0] as ClubResponse | undefined) ?? null;
}

export async function getAllSamsTeams(): Promise<PaginatedResult<TeamResponse>> {
	const result = await docClient.send(
		new ScanCommand({
			TableName: SAMS_TEAMS_TABLE_NAME(),
		}),
	);

	return toPaginatedResult(result.Items as TeamResponse[] | undefined, result.LastEvaluatedKey as Record<string, unknown> | undefined);
}

export async function getSamsTeamByUuid(uuid: string): Promise<TeamResponse | null> {
	const result = await docClient.send(
		new GetCommand({
			TableName: SAMS_TEAMS_TABLE_NAME(),
			Key: { uuid },
		}),
	);

	return (result.Item as TeamResponse | undefined) ?? null;
}
