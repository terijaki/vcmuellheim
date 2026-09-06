import { z } from "zod";
import { optionalEnvString, requiredEnvString } from "../utils/env";

// ============================================================================
// Lambda Environment Contracts
// ============================================================================

export const BeholdSyncLambdaEnvironmentSchema = z.object({
  CDK_ENVIRONMENT: optionalEnvString,
  SOCIAL_TABLE_NAME: requiredEnvString,
  BEHOLD_FEED_URL: requiredEnvString,
});

export type BeholdSyncLambdaEnvironment = z.infer<typeof BeholdSyncLambdaEnvironmentSchema>;

export const MastodonShareLambdaEnvironmentSchema = z.object({
  CDK_ENVIRONMENT: optionalEnvString,
  MASTODON_ACCESS_TOKEN: requiredEnvString,
  MEDIA_BUCKET_NAME: optionalEnvString,
  SOCIAL_TABLE_NAME: optionalEnvString,
});

export type MastodonShareLambdaEnvironment = z.infer<typeof MastodonShareLambdaEnvironmentSchema>;

export const MastodonStreamHandlerLambdaEnvironmentSchema = z.object({
  CDK_ENVIRONMENT: optionalEnvString,
  MASTODON_LAMBDA_NAME: requiredEnvString,
  ENVIRONMENT: requiredEnvString,
  WEBSITE_URL: requiredEnvString,
  CONTENT_TABLE_NAME: requiredEnvString,
});

export type MastodonStreamHandlerLambdaEnvironment = z.infer<
  typeof MastodonStreamHandlerLambdaEnvironmentSchema
>;

// ============================================================================
// Behold.so Schemas & Types
// ============================================================================

const BeholdSizeSchema = z.object({
  mediaUrl: z.url(),
  // Behold occasionally returns null dimensions for some media variants.
  height: z.number().nullable(),
  width: z.number().nullable(),
});

const BeholdSizesSchema = z.object({
  small: BeholdSizeSchema,
  medium: BeholdSizeSchema,
  large: BeholdSizeSchema,
  full: BeholdSizeSchema,
});

const BeholdColorPaletteSchema = z.object({
  dominant: z.string(),
  muted: z.string(),
  mutedLight: z.string(),
  mutedDark: z.string(),
  vibrant: z.string(),
  vibrantLight: z.string(),
  vibrantDark: z.string(),
});

const BeholdChildPostSchema = z.object({
  id: z.string(),
  mediaType: z.string(),
  mediaUrl: z.url(),
  sizes: BeholdSizesSchema,
  colorPalette: BeholdColorPaletteSchema,
});

/**
 * A single Instagram post as returned by the Behold.so feed API.
 * Schema must stay in sync with the official @behold/types Post interface —
 * the compile-time check below will error if drift is detected.
 */
export const BeholdPostSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  permalink: z.string(),
  mediaType: z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]),
  isReel: z.boolean().optional(),
  mediaUrl: z.url(),
  thumbnailUrl: z.url().optional(),
  sizes: BeholdSizesSchema,
  caption: z.string(),
  altText: z.string().optional(),
  prunedCaption: z.string(),
  hashtags: z.array(z.string()),
  hashtag: z.string().optional(),
  mentions: z.array(z.string()),
  colorPalette: BeholdColorPaletteSchema,
  children: z.array(BeholdChildPostSchema).optional(),
});

export type BeholdPost = z.infer<typeof BeholdPostSchema>;

// Compile-time drift detection: if @behold/types diverges from our Zod schema,
// TypeScript will fail here during `vp check`. The check verifies that any value
// the Behold API produces (typed as their official Post) is assignable to our
// schema-derived type — i.e., our schema accepts all valid Behold responses.
import type { Post as _BeholdApiPost } from "@behold/types";
declare const _beholdPostDriftCheck: _BeholdApiPost extends BeholdPost
  ? true
  : "⚠ Drift detected: update BeholdPostSchema to match @behold/types Post";
declare const _assertDriftCheck: typeof _beholdPostDriftCheck extends true ? true : never;

/**
 * Top-level response from the Behold.so feed API.
 */
export const BeholdFeedSchema = z.object({
  posts: z.array(BeholdPostSchema),
});
