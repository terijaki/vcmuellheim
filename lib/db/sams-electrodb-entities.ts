/**
 * ElectroDB entity definitions for the single SAMS data table.
 *
 * Single table design: SamsClub and SamsTeam share one DynamoDB table (`SAMS_TABLE_NAME`).
 *
 * Table key structure:
 *   PK  (pk)     — entity_type#uuid  (e.g. "samsclub#uuid")
 *   SK  (sk)     — entity_type#      (constant per entity)
 *   GSI1: gsi1pk / gsi1sk  — type-based list queries sorted by nameSlug
 *   GSI2: gsi2pk / gsi2sk  — season-scoped team queries (teams only)
 */

import { Entity } from "electrodb";

/** Shared GSI names used across SAMS entities in the single SAMS data table */
export const SamsTableIndexes = {
	/** Main table index */
	table: "table",
	/** Type + nameSlug sorted queries (club list, team list by slug) */
	gsi1: "GSI1-BySamsType",
	/** Season-scoped team queries (teams only) */
	gsi2: "GSI2-BySamsSeasonUuid",
} as const;

// ---------------------------------------------------------------------------
// SamsClub entity
// ---------------------------------------------------------------------------

export const SamsClubEntity = new Entity({
	model: {
		entity: "samsclub",
		service: "vcm",
		version: "1",
	},
	attributes: {
		sportsclubUuid: { type: "string", required: true },
		type: { type: "string", required: true, default: () => "club" as const },
		name: { type: "string", required: true },
		nameSlug: { type: "string", required: true },
		associationUuid: { type: "string" },
		associationName: { type: "string" },
		logoImageLink: { type: "string" },
		logoS3Key: { type: "string" },
		updatedAt: { type: "string", required: true },
		ttl: { type: "number", required: true },
	},
	indexes: {
		bySportsclubUuid: {
			pk: { field: "pk", composite: ["sportsclubUuid"] },
			sk: { field: "sk", composite: [] },
		},
		byType: {
			index: SamsTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["type"] },
			sk: { field: "gsi1sk", composite: ["nameSlug"] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// SamsTeam entity
// ---------------------------------------------------------------------------

export const SamsTeamEntity = new Entity({
	model: {
		entity: "samsteam",
		service: "vcm",
		version: "1",
	},
	attributes: {
		uuid: { type: "string", required: true },
		type: { type: "string", required: true, default: () => "team" as const },
		name: { type: "string", required: true },
		nameSlug: { type: "string", required: true },
		sportsclubUuid: { type: "string", required: true },
		associationUuid: { type: "string", required: true },
		leagueUuid: { type: "string", required: true },
		leagueName: { type: "string", required: true },
		seasonUuid: { type: "string", required: true },
		seasonName: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
		ttl: { type: "number", required: true },
	},
	indexes: {
		byUuid: {
			pk: { field: "pk", composite: ["uuid"] },
			sk: { field: "sk", composite: [] },
		},
		byType: {
			index: SamsTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["type"] },
			sk: { field: "gsi1sk", composite: ["nameSlug"] },
		},
		bySeasonUuid: {
			index: SamsTableIndexes.gsi2,
			pk: { field: "gsi2pk", composite: ["seasonUuid"] },
			sk: { field: "gsi2sk", composite: ["name"] },
		},
	},
} as const);

/** All SAMS entities — useful for building a service */
export const SamsEntities = {
	club: SamsClubEntity,
	team: SamsTeamEntity,
} as const;

export type SamsEntityName = keyof typeof SamsEntities;
