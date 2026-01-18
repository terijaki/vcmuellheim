import dayjs from "dayjs";

/**
 * Repository instances for all content entities
 */

import type { ClubResponse, TeamResponse } from "@/lambda/sams/types";
import { getTableName } from "./client";
import { Repository, SamsRepository } from "./repository";
import type { Bus, Event, Location, Media, Member, News, Sponsor, Team } from "./types";

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
		indexName: "GSI-NewsQueries",
		keyConditionExpression: "#type = :type",
		expressionAttributeNames: {
			"#type": "type",
		},
		expressionAttributeValues: {
			":type": "article",
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

/**
 * Get published news articles, sorted by date descending, with pagination support.
 */
export async function getPublishedNews(limit = 10, startKey?: Record<string, unknown>) {
	const result = await newsRepository.query({
		indexName: "GSI-NewsQueries",
		keyConditionExpression: "#type = :type",
		filterExpression: "#status = :status",
		expressionAttributeNames: {
			"#type": "type",
			"#status": "status",
		},
		expressionAttributeValues: {
			":type": "article",
			":status": "published",
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
		keyConditionExpression: "#type = :type AND #slug = :slug",
		expressionAttributeNames: {
			"#type": "type",
			"#slug": "slug",
		},
		expressionAttributeValues: {
			":type": "article",
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
