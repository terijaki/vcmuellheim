/**
 * DynamoDB entity types inferred from Zod schemas
 *
 * Import types from this file, not from schemas.ts
 * This provides a clean separation between runtime validation and type definitions
 */

import type { z } from "zod";
import type {
  busSchema,
  eventSchema,
  locationSchema,
  mediaSchema,
  memberSchema,
  apiKeySchema,
  newsSchema,
  publicApiKeySchema,
  sponsorSchema,
  teamSchema,
  volunteerEventSchema,
  volunteerSignupSchema,
  volunteerTokenSchema,
} from "./schemas";

/** Inferred types from Zod schemas */
export type ApiKey = z.infer<typeof apiKeySchema>;
export type PublicApiKey = z.infer<typeof publicApiKeySchema>;
export type News = z.infer<typeof newsSchema>;
export type Event = z.infer<typeof eventSchema>;
export type Team = z.infer<typeof teamSchema>;
export type Member = z.infer<typeof memberSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type Sponsor = z.infer<typeof sponsorSchema>;
export type Location = z.infer<typeof locationSchema>;
export type Bus = z.infer<typeof busSchema>;
export type VolunteerEvent = z.infer<typeof volunteerEventSchema>;
export type VolunteerSignup = z.infer<typeof volunteerSignupSchema>;
export type VolunteerToken = z.infer<typeof volunteerTokenSchema>;
/** Base entity type (all entities extend this) */
export type BaseEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

/** Opaque pagination cursor (`encodeDynamoCursor` / `decodeDynamoCursor`). */
export type PaginationCursor = string;
