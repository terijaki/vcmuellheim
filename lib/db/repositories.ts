/**
 * Repository instances for all content entities
 */

import type { ClubResponse, TeamResponse } from "@/lambda/sams/types";
import { TABLE_NAMES } from "./client";
import { Repository, SamsRepository } from "./repository";
import type { Bus, Event, Location, Media, Member, News, Sponsor, Team } from "./types";

/** News repository */
export const newsRepository = new Repository<News>({
	tableName: TABLE_NAMES.NEWS,
});

/** Events repository */
export const eventsRepository = new Repository<Event>({
	tableName: TABLE_NAMES.EVENTS,
});

/** Teams repository */
export const teamsRepository = new Repository<Team>({
	tableName: TABLE_NAMES.TEAMS,
});

/** Members repository */
export const membersRepository = new Repository<Member>({
	tableName: TABLE_NAMES.MEMBERS,
});

/** Media repository */
export const mediaRepository = new Repository<Media>({
	tableName: TABLE_NAMES.MEDIA,
});

/** Sponsors repository */
export const sponsorsRepository = new Repository<Sponsor>({
	tableName: TABLE_NAMES.SPONSORS,
});

/** Locations repository */
export const locationsRepository = new Repository<Location>({
	tableName: TABLE_NAMES.LOCATIONS,
});

/** Bus bookings repository */
export const busRepository = new Repository<Bus>({
	tableName: TABLE_NAMES.BUS,
});

/** Sams Clubs repository */
export const samsClubsRepository = new SamsRepository<ClubResponse>({
	tableName: "SamsClubsTable",
	identifier: "sportsclubUuid",
});

/** Sams Teams repository */
export const samsTeamsRepository = new SamsRepository<TeamResponse>({
	tableName: "SamsTeamsTable",
	identifier: "uuid",
});

/**
 * Domain-specific query helpers
 */

/** Get all news articles (for admin), sorted by date descending */
export async function getAllNews(limit = 100) {
	return newsRepository.query({
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
	});
}

/** Get published news articles, sorted by date descending */
export async function getPublishedNews(limit = 10) {
	return newsRepository.query({
		indexName: "GSI-NewsQueries",
		keyConditionExpression: "#type = :type AND #status = :status",
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
	});
}

/** Get news article by slug */
export async function getNewsBySlug(slug: string) {
	const result = await newsRepository.query({
		indexName: "GSI-NewsQueries",
		keyConditionExpression: "#type = :type AND slug = :slug",
		expressionAttributeNames: {
			"#type": "type",
		},
		expressionAttributeValues: {
			":type": "article",
			":slug": slug,
		},
		limit: 1,
	});
	return result.items[0] || null;
}

/** Get upcoming events, sorted by start date */
export async function getUpcomingEvents(limit = 20) {
	const now = new Date().toISOString();
	const result = await eventsRepository.scan({ limit: 100 }); // Get more to filter

	// Filter and sort events that haven't started yet
	const upcomingEvents = result.items
		.filter((event) => event.startDate >= now)
		.sort((a, b) => a.startDate.localeCompare(b.startDate))
		.slice(0, limit);

	return {
		items: upcomingEvents,
		lastEvaluatedKey: result.lastEvaluatedKey,
	};
}

/** Get team by slug */
export async function getTeamBySlug(slug: string) {
	const result = await teamsRepository.query({
		indexName: "GSI-Slug",
		keyConditionExpression: "slug = :slug",
		expressionAttributeValues: {
			":slug": slug,
		},
		limit: 1,
	});
	return result.items[0] || null;
}

/** Get team by SAMS/SBVV team ID */
export async function getTeamBySamsId(sbvvTeamId: string) {
	const result = await teamsRepository.query({
		indexName: "GSI-SamsTeam",
		keyConditionExpression: "sbvvTeamId = :sbvvTeamId",
		expressionAttributeValues: {
			":sbvvTeamId": sbvvTeamId,
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
/** Get Sams Teams */
export async function getAllSamsTeams() {
	return samsTeamsRepository.scan();
}
/** Get Sams Team by ID */
export async function getSamsTeamByUuid(uuid: string) {
	return samsTeamsRepository.get(uuid);
}
