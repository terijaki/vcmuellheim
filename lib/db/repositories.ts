import dayjs from "dayjs";

/**
 * Repository instances for all content entities
 */

import { PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { ClubResponse, TeamResponse } from "@/lambda/sams/types";
import { docClient, getTableName } from "./client";
import { Repository, SamsRepository } from "./repository";
import type { AuthVerification, Bus, CmsUser, Event, Location, Media, Member, News, Sponsor, Team } from "./types";

/** News repository */
export const newsRepository = new Repository<News>({
	tableName: getTableName("NEWS"),
});

/** Events repository */
export const eventsRepository = new Repository<Event>({
	tableName: getTableName("EVENTS"),
});

/** Teams repository */
export const teamsRepository = new Repository<Team>({
	tableName: getTableName("TEAMS"),
});

/** Members repository */
export const membersRepository = new Repository<Member>({
	tableName: getTableName("MEMBERS"),
});

/** Media repository */
export const mediaRepository = new Repository<Media>({
	tableName: getTableName("MEDIA"),
});

/** Sponsors repository */
export const sponsorsRepository = new Repository<Sponsor>({
	tableName: getTableName("SPONSORS"),
});

/** Locations repository */
export const locationsRepository = new Repository<Location>({
	tableName: getTableName("LOCATIONS"),
});

/** Bus bookings repository */
export const busRepository = new Repository<Bus>({
	tableName: getTableName("BUS"),
});

/** CMS users repository (admin users allowed to log in) */
export const cmsUsersRepository = new Repository<CmsUser>({
	tableName: getTableName("USERS"),
});

/** Auth verifications repository (OTP codes) */
export const authVerificationsRepository = new Repository<AuthVerification>({
	tableName: getTableName("AUTH_VERIFICATIONS"),
});

/** Sams Clubs repository */
export const samsClubsRepository = new SamsRepository<ClubResponse>({
	tableName: process.env.SAMS_CLUBS_TABLE_NAME || "",
	identifier: "sportsclubUuid",
});

/** Sams Teams repository */
export const samsTeamsRepository = new SamsRepository<TeamResponse>({
	tableName: process.env.SAMS_TEAMS_TABLE_NAME || "",
	identifier: "uuid",
});

/**
 * Domain-specific query helpers
 */

/**
 * Get all news articles (for admin), sorted by date descending, with pagination support.
 * @param {number} limit - Maximum number of items to return
 * @param {object} [startKey] - Optional start key for pagination (DynamoDB LastEvaluatedKey)
 * @returns {Promise<{ items: News[]; lastEvaluatedKey?: Record<string, unknown> }>} Items and pagination key
 */
export async function getAllNews(limit = 100, startKey?: Record<string, unknown>) {
	const result = await newsRepository.query({
		indexName: "GSI-NewsByType",
		keyConditionExpression: "#type = :type AND #updatedAt > :minDate",
		expressionAttributeNames: {
			"#type": "type",
			"#updatedAt": "updatedAt",
		},
		expressionAttributeValues: {
			":type": "article",
			":minDate": "2000-01-01T00:00:00.000Z",
		},
		scanIndexForward: false,
		limit,
		exclusiveStartKey: startKey,
	});
	return {
		items: result.items,
		lastEvaluatedKey: result.lastEvaluatedKey as Record<string, unknown> | undefined,
	};
}

/**
 * Get published news articles, sorted by date descending, with pagination support.
 */
export async function getPublishedNews(limit = 10, startKey?: Record<string, unknown>) {
	const result = await newsRepository.query({
		indexName: "GSI-NewsByStatus",
		keyConditionExpression: "#status = :status AND #updatedAt > :minDate",
		expressionAttributeNames: {
			"#status": "status",
			"#updatedAt": "updatedAt",
		},
		expressionAttributeValues: {
			":status": "published",
			":minDate": "2000-01-01T00:00:00.000Z", // Include all published articles
		},
		scanIndexForward: false, // Descending order (newest first)
		limit,
		exclusiveStartKey: startKey,
	});
	return {
		items: result.items,
		lastEvaluatedKey: result.lastEvaluatedKey as Record<string, unknown> | undefined,
	};
}

/** Get news article by slug */
export async function getNewsBySlug(slug: string) {
	const result = await newsRepository.query({
		indexName: "GSI-NewsBySlug",
		keyConditionExpression: "#slug = :slug",
		expressionAttributeNames: {
			"#slug": "slug",
		},
		expressionAttributeValues: {
			":slug": slug,
		},
		limit: 1,
	});
	return result.items[0] || null;
}

/** Get upcoming events, sorted by start date ascending */
export async function getUpcomingEvents(limit = 20) {
	// Only return events with startDate >= now, sorted ascending (soonest first)
	const now = dayjs().toISOString();
	return eventsRepository.query({
		indexName: "GSI-EventQueries",
		keyConditionExpression: "#type = :type AND #startDate >= :now",
		expressionAttributeNames: {
			"#type": "type",
			"#startDate": "startDate",
		},
		expressionAttributeValues: {
			":type": "event",
			":now": now,
		},
		scanIndexForward: true, // Ascending order (soonest first)
		limit,
	});
}

/** Get team by slug */
export async function getTeamBySlug(slug: string) {
	const result = await teamsRepository.query({
		indexName: "GSI-TeamQueries",
		keyConditionExpression: "#type = :type AND #slug = :slug",
		expressionAttributeNames: {
			"#type": "type",
			"#slug": "slug",
		},
		expressionAttributeValues: {
			":type": "team",
			":slug": slug,
		},
		limit: 1,
	});
	return result.items[0] || null;
}

/** Get all teams */
export async function getAllTeams() {
	return teamsRepository.scan();
}

/** Get all sponsors (active and expired are handled by TTL) */
export async function getAllSponsors() {
	return sponsorsRepository.scan();
}

/** Get all locations */
export async function getAllLocations() {
	return locationsRepository.scan();
}

/** Get all members (small dataset, scan is acceptable) */
export async function getAllMembers() {
	return membersRepository.scan();
}

/** Get board members (Vorstand) */
export async function getBoardMembers() {
	return membersRepository.scan({
		filterExpression: "isBoardMember = :isBoardMember",
		expressionAttributeValues: {
			":isBoardMember": true,
		},
	});
}

/** Get trainers */
export async function getTrainers() {
	return membersRepository.scan({
		filterExpression: "isTrainer = :isTrainer",
		expressionAttributeValues: {
			":isTrainer": true,
		},
	});
}

/**
 * SAMS-specific queries
 */

/** Get Sams Clubs */
export async function getAllSamsClubs() {
	return samsClubsRepository.scan();
}
/** Get Sams Club by ID */
export async function getSamsClubBySportsclubUuid(sportsclubUuid: string) {
	return samsClubsRepository.get(sportsclubUuid);
}
/** Get Sams Club by nameSlug */
export async function getSamsClubByNameSlug(nameSlug: string) {
	const result = await samsClubsRepository.query({
		indexName: "GSI-SamsClubQueries",
		keyConditionExpression: "#type = :type AND begins_with(#nameSlug, :nameSlug)",
		expressionAttributeNames: {
			"#type": "type",
			"#nameSlug": "nameSlug",
		},
		expressionAttributeValues: {
			":type": "club",
			":nameSlug": nameSlug,
		},
		limit: 1,
	});
	return result.items[0] || null;
}
/** Get Sams Teams */
export async function getAllSamsTeams() {
	return samsTeamsRepository.scan();
}
/** Get Sams Team by ID */
export async function getSamsTeamByUuid(uuid: string) {
	return samsTeamsRepository.get(uuid);
}

/**
 * CMS User queries
 */

/** Get CMS user by email using GSI */
export async function getCmsUserByEmail(email: string): Promise<CmsUser | null> {
	const tableName = getTableName("USERS");
	const result = await docClient.send(
		new QueryCommand({
			TableName: tableName,
			IndexName: "GSI-UsersByEmail",
			KeyConditionExpression: "#email = :email",
			ExpressionAttributeNames: { "#email": "email" },
			ExpressionAttributeValues: { ":email": email },
			Limit: 1,
		}),
	);
	return (result.Items?.[0] as CmsUser) || null;
}

/** Get all CMS users */
export async function getAllCmsUsers(): Promise<CmsUser[]> {
	const tableName = getTableName("USERS");
	const result = await docClient.send(
		new ScanCommand({
			TableName: tableName,
		}),
	);
	return (result.Items as CmsUser[]) || [];
}

/**
 * Auth verification queries (OTP codes)
 */

/** Find verification by identifier (email) and type using GSI */
export async function getAuthVerificationByIdentifier(identifier: string): Promise<AuthVerification | null> {
	const tableName = getTableName("AUTH_VERIFICATIONS");
	const result = await docClient.send(
		new QueryCommand({
			TableName: tableName,
			IndexName: "GSI-VerificationsByIdentifier",
			KeyConditionExpression: "#identifier = :identifier",
			ExpressionAttributeNames: { "#identifier": "identifier" },
			ExpressionAttributeValues: { ":identifier": identifier },
			Limit: 1,
		}),
	);
	return (result.Items?.[0] as AuthVerification) || null;
}

/** Create a new auth verification record */
export async function createAuthVerification(data: AuthVerification): Promise<void> {
	const tableName = getTableName("AUTH_VERIFICATIONS");
	await docClient.send(
		new PutCommand({
			TableName: tableName,
			Item: data,
		}),
	);
}

/** Get auth verification by id */
export async function getAuthVerificationById(id: string): Promise<AuthVerification | null> {
	return authVerificationsRepository.get(id);
}
