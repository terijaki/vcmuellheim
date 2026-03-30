/**
 * Zod validation schemas for DynamoDB entities
 * Using Zod v4 top-level string formats for optimal performance
 */

import { z } from "zod";

/** Base fields for all entities */
export const baseEntityFields = {
	id: z.uuid(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
} as const;

/** News article schema */
export const newsSchema = z.object({
	...baseEntityFields,
	type: z.literal("article").describe("Entity type, primary key for GSI queries"),
	title: z.string().min(1).max(200),
	slug: z.string().min(1).max(200),
	content: z.string().min(1).describe("Tiptap rich text content in HTML format"),
	excerpt: z.string().max(500).optional(),
	status: z.enum(["draft", "published", "archived"]),
	imageS3Keys: z.array(z.string()).optional().describe("Array of S3 keys for image gallery"),
	tags: z.array(z.string()).optional(),
	sharedToMastodon: z.boolean().optional().describe("Whether this news article has been shared to Mastodon"),
});

/** Event schema */
export const eventSchema = z.object({
	...baseEntityFields,
	type: z.literal("event").describe("Entity type, primary key for GSI queries"),
	title: z.string().min(1).max(200),
	description: z.string().optional(),
	startDate: z.iso.datetime(),
	endDate: z.iso.datetime().optional(),
	location: z.string().optional(),
	variant: z.string().optional(),
	teamIds: z.array(z.uuid()).optional().describe("Associated team IDs, to filter events by teams"),
	ttl: z.number().int().positive().optional().describe("Unix timestamp for DynamoDB TTL"),
});

/** Training schedule schema */
export const trainingScheduleSchema = z.object({
	days: z.array(z.number().int().min(0).max(6)).describe("0 = Sunday, 1 = Monday, ..., 6 = Saturday (matches dayjs)"),
	startTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
		.describe("HH:MM format"),
	endTime: z
		.string()
		.regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
		.describe("HH:MM format"),
	locationId: z.uuid(),
});

/** Team schema */
export const teamSchema = z.object({
	...baseEntityFields,
	type: z.literal("team").describe("Entity type, primary key for GSI queries"),
	name: z.string().min(1).max(100),
	slug: z.string().min(1).max(100),
	description: z.string().optional(),
	sbvvTeamId: z.string().optional(),
	ageGroup: z.string().optional(),
	gender: z.enum(["male", "female", "mixed"]),
	league: z.string().optional(),
	trainerIds: z.array(z.string()).optional(),
	pointOfContactIds: z.array(z.string()).optional(),
	pictureS3Keys: z.array(z.string()).optional(),
	trainingSchedules: z.array(trainingScheduleSchema).optional(),
});

/** Member schema */
export const memberSchema = z.object({
	...baseEntityFields,
	type: z.literal("member").default("member").describe("Entity type, primary key for GSI queries"),
	name: z.string().min(1).max(200),
	email: z.email().optional(),
	phone: z.string().optional(),
	isBoardMember: z.boolean().optional(),
	isTrainer: z.boolean().optional(),
	roleTitle: z.string().max(100).optional(),
	avatarS3Key: z.string().optional(),
});

/** Media schema */
export const mediaSchema = z.object({
	...baseEntityFields,
	filename: z.string().min(1),
	mimeType: z.string().regex(/^[a-z]+\/[a-z0-9\-+.]+$/),
	url: z.url(),
	s3Key: z.string().min(1),
	s3Bucket: z.string().min(1),
	alt: z.string().optional(),
	caption: z.string().optional(),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional(),
	fileSize: z.number().int().positive(),
	uploadedBy: z.string(),
});

/** Sponsor schema */
export const sponsorSchema = z.object({
	...baseEntityFields,
	type: z.literal("sponsor").default("sponsor").describe("Entity type, primary key for GSI queries"),
	name: z.string().min(1).max(200),
	description: z.string().optional(),
	websiteUrl: z.url().optional(),
	logoS3Key: z.string().optional(),
	ttl: z.number().int().positive().optional().describe("Unix timestamp for DynamoDB TTL"),
});

/** Location schema */
export const locationSchema = z.object({
	...baseEntityFields,
	type: z.literal("location").default("location").describe("Entity type, primary key for GSI queries"),
	name: z.string().min(1).max(200),
	description: z.string().optional(),
	street: z.string().min(1).max(200),
	postal: z.string().min(1).max(20),
	city: z.string().min(1).max(100),
});

/** Bus Booking schema */
export const busSchema = z.object({
	id: z.uuid(),
	type: z.literal("bus").default("bus").describe("Entity type, primary key for GSI queries"),
	driver: z.string().min(1),
	comment: z.string().optional(),
	from: z.iso.datetime(),
	to: z.iso.datetime(),
	ttl: z.number().int().positive().describe("Unix timestamp for TTL"),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

/** CMS User schema (admin users allowed to log in) */
export const cmsUserSchema = z.object({
	id: z.uuid(),
	type: z.literal("user").default("user").describe("Entity type, primary key for GSI queries"),
	email: z.email(),
	name: z.string().min(1).max(200),
	emailVerified: z.boolean().default(false),
	role: z.enum(["Admin", "Moderator"]),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

/** Auth verification schema (OTP codes stored temporarily) */
export const authVerificationSchema = z.object({
	id: z.uuid(),
	identifier: z.string().min(1).describe("Email address"),
	value: z.string().min(1).describe("OTP code (hashed)"),
	expiresAt: z.iso.datetime(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	ttl: z.number().int().positive().describe("Unix timestamp for DynamoDB TTL"),
});

/** Export types inferred from schemas */
export type NewsInput = z.infer<typeof newsSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type MemberInput = z.infer<typeof memberSchema>;
export type MediaInput = z.infer<typeof mediaSchema>;
export type SponsorInput = z.infer<typeof sponsorSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type BusInput = z.infer<typeof busSchema>;
export type TrainingScheduleInput = z.infer<typeof trainingScheduleSchema>;

// ---------------------------------------------------------------------------
// SAMS entity schemas
// ---------------------------------------------------------------------------

/** SAMS club record (synced from external SAMS API) */
export const samsClubSchema = z.object({
	sportsclubUuid: z.string().min(1),
	type: z.literal("club").default("club").describe("Entity type discriminator for GSI queries"),
	name: z.string().min(1),
	nameSlug: z.string().min(1).describe("URL-safe slug for case-insensitive queries"),
	associationUuid: z.string().optional(),
	associationName: z.string().optional(),
	logoImageLink: z.string().optional(),
	logoS3Key: z.string().optional(),
	updatedAt: z.iso.datetime(),
	ttl: z.number().int().positive().describe("Unix timestamp for DynamoDB TTL (30-day expiry)"),
});

/** SAMS team record (synced from external SAMS API — only VC Müllheim teams) */
export const samsTeamSchema = z.object({
	uuid: z.string().min(1),
	type: z.literal("team").default("team").describe("Entity type discriminator for GSI queries"),
	name: z.string().min(1),
	nameSlug: z.string().min(1).describe("URL-safe slug for case-insensitive queries"),
	sportsclubUuid: z.string().min(1),
	associationUuid: z.string().min(1),
	leagueUuid: z.string().min(1),
	leagueName: z.string().min(1),
	seasonUuid: z.string().min(1),
	seasonName: z.string().min(1),
	updatedAt: z.iso.datetime(),
	ttl: z.number().int().positive().describe("Unix timestamp for DynamoDB TTL (1-year expiry)"),
});

export type SamsClubInput = z.infer<typeof samsClubSchema>;
export type SamsTeamInput = z.infer<typeof samsTeamSchema>;
