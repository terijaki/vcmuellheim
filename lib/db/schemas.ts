

/**
 * Zod validation schemas for DynamoDB entities
 * Using Zod v4 top-level string formats for optimal performance
 */

import { z } from "zod";

/** Base fields for all entities */
const baseEntityFields = {
	id: z.uuid(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
} as const;

/** News article schema */
export const newsSchema = z.object({
	...baseEntityFields,
	title: z.string().min(1).max(200),
	slug: z.string().min(1).max(200),
	content: z.string().min(1),
	excerpt: z.string().max(500).optional(),
	publishedDate: z.iso.datetime(),
	status: z.enum(["draft", "published", "archived"]),
	authorId: z.string(),
	featuredImageId: z.uuid().optional(),
	tags: z.array(z.string()).optional(),
});

/** Event schema */
export const eventSchema = z.object({
	...baseEntityFields,
	title: z.string().min(1).max(200),
	description: z.string().optional(),
	startDate: z.iso.datetime(),
	endDate: z.iso.datetime().optional(),
	location: z.string().optional(),
	status: z.enum(["upcoming", "past", "cancelled"]),
	type: z.enum(["match", "training", "meeting", "social", "other"]),
	teamId: z.uuid().optional(),
	relatedSamsMatchId: z.string().optional(),
});

/** Team schema */
export const teamSchema = z.object({
	...baseEntityFields,
	name: z.string().min(1).max(100),
	slug: z.string().min(1).max(100),
	description: z.string().optional(),
	status: z.enum(["active", "inactive"]),
	sbvvTeamId: z.string().optional(),
	ageGroup: z.string().optional(),
	gender: z.enum(["male", "female", "mixed"]).optional(),
	league: z.string().optional(),
	coachId: z.uuid().optional(),
	imageId: z.uuid().optional(),
});

/** Member schema */
export const memberSchema = z.object({
	...baseEntityFields,
	name: z.string().min(1).max(200),
	email: z.email().optional(),
	phone: z.string().optional(),
	isVorstand: z.boolean().optional(),
	isTrainer: z.boolean().optional(),
	roleTitle: z.string().max(100).optional(),
	avatarId: z.uuid().optional(),
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
	name: z.string().min(1).max(200),
	description: z.string().optional(),
	websiteUrl: z.url().optional(),
	logoId: z.uuid().optional(),
	expiryTimestamp: z.number().int().positive().optional(),
});


/** Bus Booking schema */
export const busSchema = z.object({
	id: z.uuid(),
	driver: z.string().min(1),
	comment: z.string().optional(),
	from: z.iso.datetime(),
	to: z.iso.datetime(),
	ttl: z.number().int().positive(), // Unix timestamp for TTL
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});

/** Export types inferred from schemas */
export type NewsInput = z.infer<typeof newsSchema>;
export type EventInput = z.infer<typeof eventSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type MemberInput = z.infer<typeof memberSchema>;
export type MediaInput = z.infer<typeof mediaSchema>;
export type SponsorInput = z.infer<typeof sponsorSchema>;
export type BusInput = z.infer<typeof busSchema>;
