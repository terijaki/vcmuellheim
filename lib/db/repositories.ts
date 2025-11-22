/**
 * Repository instances for all content entities
 */

import { TABLE_NAMES } from "./client";
import { Repository } from "./repository";
import type { Event, Media, Member, News, Sponsor, Team } from "./types";

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

/**
 * Domain-specific query helpers
 */

/** Get published news articles, sorted by date descending */
export async function getPublishedNews(limit = 10) {
	return newsRepository.query({
		indexName: "GSI-PublishedDate",
		keyConditionExpression: "#status = :status",
		expressionAttributeNames: {
			"#status": "status",
		},
		expressionAttributeValues: {
			":status": "published",
		},
		scanIndexForward: false, // Descending order (newest first)
		limit,
	});
}

/** Get news article by slug */
export async function getNewsBySlug(slug: string) {
	const result = await newsRepository.query({
		indexName: "GSI-Slug",
		keyConditionExpression: "slug = :slug",
		expressionAttributeValues: {
			":slug": slug,
		},
		limit: 1,
	});
	return result.items[0] || null;
}

/** Get upcoming events, sorted by start date */
export async function getUpcomingEvents(limit = 20) {
	return eventsRepository.query({
		indexName: "GSI-StartDate",
		keyConditionExpression: "#status = :status",
		expressionAttributeNames: {
			"#status": "status",
		},
		expressionAttributeValues: {
			":status": "upcoming",
		},
		scanIndexForward: true, // Ascending order (earliest first)
		limit,
	});
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

/** Get active teams, sorted by name */
export async function getActiveTeams() {
	return teamsRepository.query({
		indexName: "GSI-Status",
		keyConditionExpression: "#status = :status",
		expressionAttributeNames: {
			"#status": "status",
		},
		expressionAttributeValues: {
			":status": "active",
		},
		scanIndexForward: true, // Ascending order by name
	});
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

/** Get active sponsors */
export async function getActiveSponsors() {
	return sponsorsRepository.scan({
		filterExpression: "#status = :status",
		expressionAttributeNames: {
			"#status": "status",
		},
		expressionAttributeValues: {
			":status": "active",
		},
	});
}

/** Get all members (small dataset, scan is acceptable) */
export async function getAllMembers() {
	return membersRepository.scan();
}

/** Get board members (Vorstand) */
export async function getBoardMembers() {
	return membersRepository.scan({
		filterExpression: "isVorstand = :isVorstand",
		expressionAttributeValues: {
			":isVorstand": true,
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
