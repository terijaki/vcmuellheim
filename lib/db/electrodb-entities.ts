/**
 * ElectroDB entity definitions for the single-table content database
 *
 * Single table design: all content entities share one DynamoDB table (`CONTENT_TABLE_NAME`).
 * ElectroDB handles composite key generation and type-safe queries.
 *
 * Table key structure:
 *   PK  (pk)     — entity_type#uuid  (e.g. "news#abc-123")
 *   SK  (sk)     — entity_type#      (constant per entity)
 *   GSI1: gsi1pk / gsi1sk  — type-based list queries sorted by date
 *   GSI2: gsi2pk / gsi2sk  — status-based queries sorted by date
 *   GSI3: gsi3pk           — slug lookups
 *   GSI4: gsi4pk           — email / identifier lookups
 */

import { Entity } from "electrodb";

/** Shared GSI names used across entities in the single content table */
export const ContentTableIndexes = {
	/** Main table index */
	table: "table",
	/** Type + date sorted queries (news list, events by startDate, teams by slug) */
	gsi1: "GSI1-ByTypeAndDate",
	/** Status + date sorted queries (news by publish status) */
	gsi2: "GSI2-ByStatus",
	/** Slug lookups (news, teams) */
	gsi3: "GSI3-BySlug",
	/** Email / identifier lookups (users, auth verifications) */
	gsi4: "GSI4-ByIdentifier",
} as const;

// ---------------------------------------------------------------------------
// News entity
// ---------------------------------------------------------------------------

export const NewsEntity = new Entity({
	model: {
		entity: "news",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		type: { type: "string", required: true, default: () => "article" as const },
		title: { type: "string", required: true },
		slug: { type: "string", required: true },
		content: { type: "string", required: true },
		excerpt: { type: "string" },
		status: {
			type: ["draft", "published", "archived"] as const,
			required: true,
		},
		imageS3Keys: { type: "list", items: { type: "string" } },
		tags: { type: "list", items: { type: "string" } },
		sharedToMastodon: { type: "boolean" },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
		byType: {
			index: ContentTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["type"] },
			sk: { field: "gsi1sk", composite: ["updatedAt"] },
		},
		byStatus: {
			index: ContentTableIndexes.gsi2,
			pk: { field: "gsi2pk", composite: ["status"] },
			sk: { field: "gsi2sk", composite: ["createdAt"] },
		},
		bySlug: {
			index: ContentTableIndexes.gsi3,
			pk: { field: "gsi3pk", composite: ["slug"] },
			sk: { field: "gsi3sk", composite: [] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// Event entity
// ---------------------------------------------------------------------------

export const EventEntity = new Entity({
	model: {
		entity: "event",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		type: { type: "string", required: true, default: () => "event" as const },
		title: { type: "string", required: true },
		description: { type: "string" },
		startDate: { type: "string", required: true },
		endDate: { type: "string" },
		location: { type: "string" },
		variant: { type: "string" },
		teamIds: { type: "list", items: { type: "string" } },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
		byType: {
			index: ContentTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["type"] },
			sk: { field: "gsi1sk", composite: ["startDate"] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// Team entity
// ---------------------------------------------------------------------------

export const TeamEntity = new Entity({
	model: {
		entity: "team",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		type: { type: "string", required: true, default: () => "team" as const },
		name: { type: "string", required: true },
		slug: { type: "string", required: true },
		description: { type: "string" },
		sbvvTeamId: { type: "string" },
		ageGroup: { type: "string" },
		gender: { type: ["male", "female", "mixed"] as const, required: true },
		league: { type: "string" },
		trainerIds: { type: "list", items: { type: "string" } },
		pointOfContactIds: { type: "list", items: { type: "string" } },
		pictureS3Keys: { type: "list", items: { type: "string" } },
		trainingSchedules: { type: "any" },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
		byType: {
			index: ContentTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["type"] },
			sk: { field: "gsi1sk", composite: ["slug"] },
		},
		bySlug: {
			index: ContentTableIndexes.gsi3,
			pk: { field: "gsi3pk", composite: ["slug"] },
			sk: { field: "gsi3sk", composite: [] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// Member entity
// ---------------------------------------------------------------------------

export const MemberEntity = new Entity({
	model: {
		entity: "member",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		type: { type: "string", required: true, default: () => "member" as const },
		name: { type: "string", required: true },
		email: { type: "string" },
		phone: { type: "string" },
		isBoardMember: { type: "boolean" },
		isTrainer: { type: "boolean" },
		roleTitle: { type: "string" },
		avatarS3Key: { type: "string" },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
		byType: {
			index: ContentTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["type"] },
			sk: { field: "gsi1sk", composite: ["updatedAt"] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// Media entity
// ---------------------------------------------------------------------------

export const MediaEntity = new Entity({
	model: {
		entity: "media",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		filename: { type: "string", required: true },
		mimeType: { type: "string", required: true },
		url: { type: "string", required: true },
		s3Key: { type: "string", required: true },
		s3Bucket: { type: "string", required: true },
		alt: { type: "string" },
		caption: { type: "string" },
		width: { type: "number" },
		height: { type: "number" },
		fileSize: { type: "number", required: true },
		uploadedBy: { type: "string", required: true },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// Sponsor entity
// ---------------------------------------------------------------------------

export const SponsorEntity = new Entity({
	model: {
		entity: "sponsor",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		type: { type: "string", required: true, default: () => "sponsor" as const },
		name: { type: "string", required: true },
		description: { type: "string" },
		websiteUrl: { type: "string" },
		logoS3Key: { type: "string" },
		ttl: { type: "number" },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
		byType: {
			index: ContentTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["type"] },
			sk: { field: "gsi1sk", composite: ["updatedAt"] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// Location entity
// ---------------------------------------------------------------------------

export const LocationEntity = new Entity({
	model: {
		entity: "location",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		type: { type: "string", required: true, default: () => "location" as const },
		name: { type: "string", required: true },
		description: { type: "string" },
		street: { type: "string", required: true },
		postal: { type: "string", required: true },
		city: { type: "string", required: true },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
		byType: {
			index: ContentTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["type"] },
			sk: { field: "gsi1sk", composite: ["updatedAt"] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// Bus Booking entity
// ---------------------------------------------------------------------------

export const BusEntity = new Entity({
	model: {
		entity: "bus",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		type: { type: "string", required: true, default: () => "bus" as const },
		driver: { type: "string", required: true },
		comment: { type: "string" },
		from: { type: "string", required: true },
		to: { type: "string", required: true },
		ttl: { type: "number", required: true },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
		byType: {
			index: ContentTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["type"] },
			sk: { field: "gsi1sk", composite: ["updatedAt"] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// CMS User entity
// ---------------------------------------------------------------------------

export const CmsUserEntity = new Entity({
	model: {
		entity: "user",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		type: { type: "string", required: true, default: () => "user" as const },
		email: { type: "string", required: true },
		name: { type: "string", required: true },
		emailVerified: { type: "boolean", required: true, default: () => false },
		role: { type: ["Admin", "Moderator"] as const, required: true },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
		byType: {
			index: ContentTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["type"] },
			sk: { field: "gsi1sk", composite: ["updatedAt"] },
		},
		byEmail: {
			index: ContentTableIndexes.gsi4,
			pk: { field: "gsi4pk", composite: ["email"] },
			sk: { field: "gsi4sk", composite: [] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// Auth Verification entity
// ---------------------------------------------------------------------------

export const AuthVerificationEntity = new Entity({
	model: {
		entity: "authverification",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		identifier: { type: "string", required: true },
		value: { type: "string", required: true },
		expiresAt: { type: "string", required: true },
		ttl: { type: "number", required: true },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
		byIdentifier: {
			index: ContentTableIndexes.gsi4,
			pk: { field: "gsi4pk", composite: ["identifier"] },
			sk: { field: "gsi4sk", composite: [] },
		},
	},
} as const);

// ---------------------------------------------------------------------------
// Session entity (better-auth session model)
//
// Not included in ContentEntities / drift tests because the schema
// is owned by better-auth, not by our Zod schemas.
// ---------------------------------------------------------------------------

export const SessionEntity = new Entity({
	model: {
		entity: "session",
		service: "vcm",
		version: "1",
	},
	attributes: {
		id: { type: "string", required: true },
		userId: { type: "string", required: true },
		token: { type: "string", required: true },
		expiresAt: { type: "string", required: true },
		ipAddress: { type: "string" },
		userAgent: { type: "string" },
		ttl: { type: "number", required: true },
		createdAt: { type: "string", required: true },
		updatedAt: { type: "string", required: true },
	},
	indexes: {
		byId: {
			pk: { field: "pk", composite: ["id"] },
			sk: { field: "sk", composite: [] },
		},
		/** GSI1 — look up all sessions for a given user */
		byUserId: {
			index: ContentTableIndexes.gsi1,
			pk: { field: "gsi1pk", composite: ["userId"] },
			sk: { field: "gsi1sk", composite: ["createdAt"] },
		},
		/** GSI3 — look up a session by its token (used during session validation) */
		byToken: {
			index: ContentTableIndexes.gsi3,
			pk: { field: "gsi3pk", composite: ["token"] },
			sk: { field: "gsi3sk", composite: [] },
		},
	},
} as const);

/** All content entities — useful for iteration (e.g. in tests) */
export const ContentEntities = {
	news: NewsEntity,
	event: EventEntity,
	team: TeamEntity,
	member: MemberEntity,
	media: MediaEntity,
	sponsor: SponsorEntity,
	location: LocationEntity,
	bus: BusEntity,
	user: CmsUserEntity,
	authverification: AuthVerificationEntity,
} as const;

export type ContentEntityName = keyof typeof ContentEntities;
