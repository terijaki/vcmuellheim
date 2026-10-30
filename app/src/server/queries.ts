import {
  type ClubResponse,
  ClubResponseSchema,
  type RosterResponse,
  RosterResponseSchema,
  type TeamResponse,
  TeamResponseSchema,
} from "@/lib/db/schemas";
import { memberSchema } from "@/lib/db/schemas";
import { memberRepository } from "@/lib/db/repositories/member-repository";
import { newsRepository } from "@/lib/db/repositories/news-repository";
import { samsClubsRepository } from "@/lib/sams/repositories/sams-clubs-repository";
import { samsRostersRepository } from "@/lib/sams/repositories/sams-rosters-repository";
import { samsTeamsRepository } from "@/lib/sams/repositories/sams-teams-repository";
import type { Member, News, PaginationCursor } from "@/lib/db/types";

type PaginatedResult<T> = {
  items: T[];
  lastEvaluatedKey?: PaginationCursor;
};

export async function getAllNews(
  limit = 100,
  cursor?: PaginationCursor,
): Promise<PaginatedResult<News>> {
  const result = await newsRepository.listAllMerged(limit, cursor);
  return { items: result.items, lastEvaluatedKey: result.lastEvaluatedKey };
}

export async function getPublishedNews(
  limit = 10,
  cursor?: PaginationCursor,
): Promise<PaginatedResult<News>> {
  const result = await newsRepository.listPublished(limit, cursor);
  return { items: result.items, lastEvaluatedKey: result.lastEvaluatedKey };
}

export async function getNewsBySlug(slug: string): Promise<News | null> {
  return newsRepository.getBySlug(slug);
}

export async function getAdminMemberByPrivateEmail(privateEmail: string): Promise<Member | null> {
  const member = await memberRepository.getByPrivateEmail(privateEmail);
  if (!member) return null;
  if (member.authRole !== "Admin" && member.authRole !== "Moderator") return null;
  return memberSchema.parse(member);
}

export async function getMemberByProxyEmail(proxyEmail: string): Promise<Member | null> {
  const member = await memberRepository.getByProxyEmail(proxyEmail);
  return member ? memberSchema.parse(member) : null;
}

export async function getAllSamsClubs(): Promise<PaginatedResult<ClubResponse>> {
  const items = await samsClubsRepository.listAll();
  return { items: items.map((item) => ClubResponseSchema.parse(item)) };
}

export async function getSamsClubBySportsclubUuid(
  sportsclubUuid: string,
): Promise<ClubResponse | null> {
  const club = await samsClubsRepository.getById(sportsclubUuid);
  return club ? ClubResponseSchema.parse(club) : null;
}

export async function getSamsClubByNameSlug(nameSlug: string): Promise<ClubResponse | null> {
  const club = await samsClubsRepository.getByNameSlug(nameSlug);
  return club ? ClubResponseSchema.parse(club) : null;
}

export async function getSamsClubByNameSlugPrefix(prefix: string): Promise<ClubResponse | null> {
  const clubs = await samsClubsRepository.queryByNameSlugPrefix(prefix);
  const club = clubs[0];
  return club ? ClubResponseSchema.parse(club) : null;
}

export async function getAllSamsTeams(): Promise<PaginatedResult<TeamResponse>> {
  const items = await samsTeamsRepository.listAll();
  return { items: items.map((item) => TeamResponseSchema.parse(item)) };
}

export async function getSamsTeamByUuid(uuid: string): Promise<TeamResponse | null> {
  const team = await samsTeamsRepository.getById(uuid);
  return team ? TeamResponseSchema.parse(team) : null;
}

export async function getSamsRosterByTeamUuid(teamUuid: string): Promise<RosterResponse | null> {
  const roster = await samsRostersRepository.getByTeamUuid(teamUuid);
  return roster ? RosterResponseSchema.parse(roster) : null;
}
