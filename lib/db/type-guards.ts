/**
 * TypeScript type guards for content entities.
 *
 * These provide early compile-time and runtime detection of drift between
 * ElectroDB entity attribute definitions and Zod schemas.
 *
 * Usage:
 *   - Import type-level assertions to catch drift at compile time (IDE errors).
 *   - Use isNews(), isTeam(), etc. at runtime to safely narrow incoming data.
 */

import type { EntityItem } from "electrodb";
import type { AuthVerificationEntity, BusEntity, CmsUserEntity, EventEntity, LocationEntity, MediaEntity, MemberEntity, NewsEntity, SponsorEntity, TeamEntity } from "./electrodb-entities";
import type { AuthVerification, Bus, CmsUser, Event, Location, Media, Member, News, Sponsor, Team } from "./types";

// ---------------------------------------------------------------------------
// Compile-time drift detection via type compatibility assertions.
//
// Strategy: we assert that `EntityItem<ElectroEntity>` is assignable to a
// Required<Pick<ZodType, requiredFields>> type.  If an attribute listed in the
// Pick does not exist on the ElectroDB entity (or has an incompatible type),
// TypeScript raises a compile error — surfacing drift immediately in the IDE.
//
// Note: discriminant `type` fields (e.g. "article", "team", "event") are
// excluded from Pick assertions because ElectroDB models them as `type:
// "string"` (widened to `string` in EntityItem), while Zod schemas use
// literal union types.  The runtime drift tests in
// `lib/db/electrodb-entities.test.ts` cover these fields exhaustively.
//
// Exported as `export type` so that `noUnusedLocals` does not flag them —
// they are intentionally "unused" by application code but are evaluated by
// the TypeScript compiler as part of the build.
// ---------------------------------------------------------------------------

type AssertAssignable<TZod, TElectro extends TZod> = TElectro;

// News
export type _NewsCheck = AssertAssignable<Required<Pick<News, "id" | "title" | "slug" | "content" | "createdAt" | "updatedAt">>, EntityItem<typeof NewsEntity>>;

// Event
export type _EventCheck = AssertAssignable<Required<Pick<Event, "id" | "title" | "startDate" | "createdAt" | "updatedAt">>, EntityItem<typeof EventEntity>>;

// Team
export type _TeamCheck = AssertAssignable<Required<Pick<Team, "id" | "name" | "slug" | "gender" | "createdAt" | "updatedAt">>, EntityItem<typeof TeamEntity>>;

// Member
export type _MemberCheck = AssertAssignable<Required<Pick<Member, "id" | "name" | "createdAt" | "updatedAt">>, EntityItem<typeof MemberEntity>>;

// Media
export type _MediaCheck = AssertAssignable<
	Required<Pick<Media, "id" | "filename" | "mimeType" | "url" | "s3Key" | "s3Bucket" | "fileSize" | "uploadedBy" | "createdAt" | "updatedAt">>,
	EntityItem<typeof MediaEntity>
>;

// Sponsor
export type _SponsorCheck = AssertAssignable<Required<Pick<Sponsor, "id" | "name" | "createdAt" | "updatedAt">>, EntityItem<typeof SponsorEntity>>;

// Location
export type _LocationCheck = AssertAssignable<Required<Pick<Location, "id" | "name" | "street" | "postal" | "city" | "createdAt" | "updatedAt">>, EntityItem<typeof LocationEntity>>;

// Bus
export type _BusCheck = AssertAssignable<Required<Pick<Bus, "id" | "driver" | "from" | "to" | "ttl" | "createdAt" | "updatedAt">>, EntityItem<typeof BusEntity>>;

// CmsUser
export type _CmsUserCheck = AssertAssignable<Required<Pick<CmsUser, "id" | "email" | "name" | "emailVerified" | "createdAt" | "updatedAt">>, EntityItem<typeof CmsUserEntity>>;

// AuthVerification
export type _AuthVerificationCheck = AssertAssignable<
	Required<Pick<AuthVerification, "id" | "identifier" | "value" | "expiresAt" | "ttl" | "createdAt" | "updatedAt">>,
	EntityItem<typeof AuthVerificationEntity>
>;

// ---------------------------------------------------------------------------
// Runtime type guards — use these to safely narrow unknown DynamoDB items
// ---------------------------------------------------------------------------

/** Type guard: checks that `item` has the minimum shape of a News article */
export function isNews(item: unknown): item is News {
	if (!item || typeof item !== "object") return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj.id === "string" &&
		obj.type === "article" &&
		typeof obj.title === "string" &&
		typeof obj.slug === "string" &&
		typeof obj.content === "string" &&
		(obj.status === "draft" || obj.status === "published" || obj.status === "archived") &&
		typeof obj.createdAt === "string" &&
		typeof obj.updatedAt === "string"
	);
}

/** Type guard: checks that `item` has the minimum shape of an Event */
export function isEvent(item: unknown): item is Event {
	if (!item || typeof item !== "object") return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj.id === "string" && obj.type === "event" && typeof obj.title === "string" && typeof obj.startDate === "string" && typeof obj.createdAt === "string" && typeof obj.updatedAt === "string"
	);
}

/** Type guard: checks that `item` has the minimum shape of a Team */
export function isTeam(item: unknown): item is Team {
	if (!item || typeof item !== "object") return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj.id === "string" &&
		obj.type === "team" &&
		typeof obj.name === "string" &&
		typeof obj.slug === "string" &&
		(obj.gender === "male" || obj.gender === "female" || obj.gender === "mixed") &&
		typeof obj.createdAt === "string" &&
		typeof obj.updatedAt === "string"
	);
}

/** Type guard: checks that `item` has the minimum shape of a Member */
export function isMember(item: unknown): item is Member {
	if (!item || typeof item !== "object") return false;
	const obj = item as Record<string, unknown>;
	return typeof obj.id === "string" && typeof obj.name === "string" && typeof obj.createdAt === "string" && typeof obj.updatedAt === "string";
}

/** Type guard: checks that `item` has the minimum shape of a Media record */
export function isMedia(item: unknown): item is Media {
	if (!item || typeof item !== "object") return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj.id === "string" &&
		typeof obj.filename === "string" &&
		typeof obj.mimeType === "string" &&
		typeof obj.url === "string" &&
		typeof obj.s3Key === "string" &&
		typeof obj.s3Bucket === "string" &&
		typeof obj.fileSize === "number" &&
		typeof obj.uploadedBy === "string" &&
		typeof obj.createdAt === "string" &&
		typeof obj.updatedAt === "string"
	);
}

/** Type guard: checks that `item` has the minimum shape of a Sponsor */
export function isSponsor(item: unknown): item is Sponsor {
	if (!item || typeof item !== "object") return false;
	const obj = item as Record<string, unknown>;
	return typeof obj.id === "string" && typeof obj.name === "string" && typeof obj.createdAt === "string" && typeof obj.updatedAt === "string";
}

/** Type guard: checks that `item` has the minimum shape of a Location */
export function isLocation(item: unknown): item is Location {
	if (!item || typeof item !== "object") return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj.id === "string" &&
		typeof obj.name === "string" &&
		typeof obj.street === "string" &&
		typeof obj.postal === "string" &&
		typeof obj.city === "string" &&
		typeof obj.createdAt === "string" &&
		typeof obj.updatedAt === "string"
	);
}

/** Type guard: checks that `item` has the minimum shape of a Bus booking */
export function isBus(item: unknown): item is Bus {
	if (!item || typeof item !== "object") return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj.id === "string" &&
		typeof obj.driver === "string" &&
		typeof obj.from === "string" &&
		typeof obj.to === "string" &&
		typeof obj.ttl === "number" &&
		typeof obj.createdAt === "string" &&
		typeof obj.updatedAt === "string"
	);
}

/** Type guard: checks that `item` has the minimum shape of a CmsUser */
export function isCmsUser(item: unknown): item is CmsUser {
	if (!item || typeof item !== "object") return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj.id === "string" &&
		typeof obj.email === "string" &&
		typeof obj.name === "string" &&
		typeof obj.emailVerified === "boolean" &&
		(obj.role === "Admin" || obj.role === "Moderator") &&
		typeof obj.createdAt === "string" &&
		typeof obj.updatedAt === "string"
	);
}

/** Type guard: checks that `item` has the minimum shape of an AuthVerification */
export function isAuthVerification(item: unknown): item is AuthVerification {
	if (!item || typeof item !== "object") return false;
	const obj = item as Record<string, unknown>;
	return (
		typeof obj.id === "string" &&
		typeof obj.identifier === "string" &&
		typeof obj.value === "string" &&
		typeof obj.expiresAt === "string" &&
		typeof obj.ttl === "number" &&
		typeof obj.createdAt === "string" &&
		typeof obj.updatedAt === "string"
	);
}
