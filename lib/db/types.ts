/**
 * DynamoDB entity types inferred from Zod schemas
 *
 * Import types from this file, not from schemas.ts
 * This provides a clean separation between runtime validation and type definitions
 */

import type { z } from "zod";
import type { authVerificationSchema, busSchema, cmsUserSchema, eventSchema, locationSchema, mediaSchema, memberSchema, newsSchema, sponsorSchema, teamSchema } from "./schemas";

/** Inferred types from Zod schemas */
export type News = z.infer<typeof newsSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Team = z.infer<typeof teamSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type Sponsor = z.infer<typeof sponsorSchema>;
export type Location = z.infer<typeof locationSchema>;
export type Bus = z.infer<typeof busSchema>;
export type CmsUser = z.infer<typeof cmsUserSchema>;
export type AuthVerification = z.infer<typeof authVerificationSchema>;

/** Base entity type (all entities extend this) */
export type BaseEntity = {
	id: string;
	createdAt: string;
	updatedAt: string;
};

/** Pagination cursor type used by DynamoDB query/scan pagination */
export type PaginationCursor = Record<string, string | number>;
