import {
  type ClubResponse,
  ClubResponseSchema,
  type RosterResponse,
  RosterResponseSchema,
  type TeamResponse,
  TeamResponseSchema,
} from "@/lib/db/schemas";
import { db, samsDb } from "@/lib/db/electrodb-client";
import { memberSchema, newsSchema } from "@/lib/db/schemas";
import type { Member, News, PaginationCursor } from "@/lib/db/types";

type PaginatedResult<T> = {
  items: T[];
  lastEvaluatedKey?: PaginationCursor;
};

// ── Content entity queries (ElectroDB) ────────────────────────────────────────

export async function getAllNews(
  limit = 100,
  cursor?: PaginationCursor,
): Promise<PaginatedResult<News>> {
  const result = await db()
    .news.query.byType({ type: "article" })
    .gt({ updatedAt: "2000-01-01T00:00:00.000Z" })
    .go({ order: "desc", limit, cursor: cursor ?? undefined });
  const items = result.data.map((item) => newsSchema.parse(item));

  return { items, lastEvaluatedKey: result.cursor ?? undefined };
}

export async function getPublishedNews(
  limit = 10,
  cursor?: PaginationCursor,
): Promise<PaginatedResult<News>> {
  const result = await db()
    .news.query.byStatus({ status: "published" })
    .gt({ createdAt: "2000-01-01T00:00:00.000Z" })
    .go({ order: "desc", limit, cursor: cursor ?? undefined });
  const items = result.data.map((item) => newsSchema.parse(item));

  return { items, lastEvaluatedKey: result.cursor ?? undefined };
}

export async function getNewsBySlug(slug: string): Promise<News | null> {
  const result = await db().news.query.bySlug({ slug }).go({ limit: 1 });
  const item = result.data[0] ? newsSchema.parse(result.data[0]) : null;
  return item ?? null;
}

/**
 * Find an admin-eligible member by their private email (canonical auth identity).
 * Only returns members with Admin or Moderator role.
 */
export async function getAdminMemberByPrivateEmail(privateEmail: string): Promise<Member | null> {
  const result = await db().member.query.byPrivateEmail({ privateEmail }).go({ limit: 1 });
  const item = result.data.find((m) => m.authRole === "Admin" || m.authRole === "Moderator");
  return item ? memberSchema.parse(item) : null;
}

/**
 * Find a member by their proxy email alias.
 * Returns any member (not gated by role) — used to resolve proxy → privateEmail for OTP delivery.
 */
export async function getMemberByProxyEmail(proxyEmail: string): Promise<Member | null> {
  const result = await db().member.query.byProxyEmail({ proxyEmail }).go({ limit: 1 });
  const item = result.data[0] ? memberSchema.parse(result.data[0]) : null;
  return item ?? null;
}

// ── SAMS entity queries (ElectroDB — single SAMS data table) ─────────────────

export async function getAllSamsClubs(): Promise<PaginatedResult<ClubResponse>> {
  const result = await samsDb().club.query.byType({ type: "club" }).go({ pages: "all" });
  return { items: result.data.map((item) => ClubResponseSchema.parse(item)) };
}

export async function getSamsClubBySportsclubUuid(
  sportsclubUuid: string,
): Promise<ClubResponse | null> {
  const result = await samsDb().club.get({ sportsclubUuid }).go();
  return result.data ? ClubResponseSchema.parse(result.data) : null;
}

export async function getSamsClubByNameSlug(nameSlug: string): Promise<ClubResponse | null> {
  const result = await samsDb()
    .club.query.byType({ type: "club" })
    .begins({ nameSlug })
    .go({ limit: 1 });
  const item = result.data.find((c) => c.nameSlug === nameSlug);
  return item ? ClubResponseSchema.parse(item) : null;
}

export async function getSamsClubByNameSlugPrefix(prefix: string): Promise<ClubResponse | null> {
  const result = await samsDb()
    .club.query.byType({ type: "club" })
    .begins({ nameSlug: prefix })
    .go({ limit: 1 });
  return result.data[0] ? ClubResponseSchema.parse(result.data[0]) : null;
}

export async function getAllSamsTeams(): Promise<PaginatedResult<TeamResponse>> {
  const result = await samsDb().team.query.byType({ type: "team" }).go({ pages: "all" });
  return { items: result.data.map((item) => TeamResponseSchema.parse(item)) };
}

export async function getSamsTeamByUuid(uuid: string): Promise<TeamResponse | null> {
  const result = await samsDb().team.get({ uuid }).go();
  return result.data ? TeamResponseSchema.parse(result.data) : null;
}

export async function getSamsRosterByTeamUuid(teamUuid: string): Promise<RosterResponse | null> {
  const result = await samsDb().roster.get({ teamUuid }).go();
  return result.data ? RosterResponseSchema.parse(result.data) : null;
}
