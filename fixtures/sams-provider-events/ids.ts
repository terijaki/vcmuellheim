import { SAMS } from "@project.config";

export const SEED_SEASON = { uuid: "season-vcm-2026-27", name: "2026/27" } as const;

const ASSOCIATION = { uuid: "assoc-sbvv", name: SAMS.association.name } as const;

export const SEED_VCM_CLUB = {
  uuid: "club-vc-muellheim",
  name: "VC Müllheim",
  slug: "vc-muellheim",
  associationUuid: ASSOCIATION.uuid,
  associationName: ASSOCIATION.name,
  picsumSeed: "club-vc-muellheim",
} as const;

export const SEED_MGV_CLUB = {
  uuid: "club-markgraefler-volleys",
  name: "Markgräfler Volleys",
  slug: "markgraefler-volleys",
  associationUuid: ASSOCIATION.uuid,
  associationName: ASSOCIATION.name,
  picsumSeed: "club-markgraefler-volleys",
} as const;

export const SEED_TARGET_CLUBS = [SEED_VCM_CLUB, SEED_MGV_CLUB] as const;
export type SeedTargetClub = (typeof SEED_TARGET_CLUBS)[number];

export const SEED_VCM_TEAMS = [
  {
    uuid: "team-vcm-1",
    name: "VC Müllheim 1. Herren",
    slug: "vc-muellheim-1-herren",
    leagueUuid: "league-vcm-landesliga",
    leagueName: "Landesliga",
    leagueHierarchyLevel: 3,
  },
  {
    uuid: "team-vcm-2",
    name: "VC Müllheim II",
    slug: "vc-muellheim-ii",
    leagueUuid: "league-vcm-verbandsliga",
    leagueName: "Verbandsliga",
    leagueHierarchyLevel: 4,
  },
  {
    uuid: "team-vcm-3",
    name: "VC Müllheim Mix",
    slug: "vc-muellheim-mix",
    leagueUuid: "league-vcm-bezirksliga",
    leagueName: "Bezirksliga",
    leagueHierarchyLevel: 5,
  },
] as const;

export const SEED_MGV_TEAMS = [
  {
    uuid: "team-mgv-1",
    name: "Markgräfler Volleys 1. Herren",
    slug: "markgraefler-volleys-1-herren",
    leagueUuid: "league-mgv-landesliga",
    leagueName: "Landesliga",
    leagueHierarchyLevel: 3,
  },
  {
    uuid: "team-mgv-2",
    name: "Markgräfler Volleys II",
    slug: "markgraefler-volleys-ii",
    leagueUuid: "league-mgv-verbandsliga",
    leagueName: "Verbandsliga",
    leagueHierarchyLevel: 4,
  },
  {
    uuid: "team-mgv-3",
    name: "Markgräfler Mix",
    slug: "markgraefler-mix",
    leagueUuid: "league-mgv-bezirksliga",
    leagueName: "Bezirksliga",
    leagueHierarchyLevel: 5,
  },
] as const;

export const SEED_CLUB_TEAMS = {
  [SEED_VCM_CLUB.uuid]: SEED_VCM_TEAMS,
  [SEED_MGV_CLUB.uuid]: SEED_MGV_TEAMS,
} as const;

export const SEED_OPPONENT_CLUBS = [
  {
    uuid: "club-opp-schwarzwald-vc",
    name: "Schwarzwald VC",
    slug: "schwarzwald-vc",
    picsumSeed: "opp-schwarzwald-vc",
    teamLabels: ["1", "Damen", "U20"],
  },
  {
    uuid: "club-opp-rhein-vc",
    name: "VfL Rheinfelden",
    slug: "rhein-vc",
    picsumSeed: "opp-rhein-vc",
    teamLabels: ["1", "2"],
  },
] as const;

export function opponentTeamDisplayName(
  club: (typeof SEED_OPPONENT_CLUBS)[number],
  opponentIndex: number,
): string {
  const label = club.teamLabels[opponentIndex % club.teamLabels.length];
  return label === "1" || label === "2" ? `${club.name} ${label}` : `${club.name} ${label}`;
}

export function opponentTeamUuid(leagueUuid: string, opponentIndex: number): string {
  return `team-opp-${leagueUuid}-${opponentIndex}`;
}

export function matchUuid(teamUuid: string, phase: "past" | "future", index: number): string {
  return `match-${teamUuid}-${phase}-${index}`;
}

export function playerUuid(teamUuid: string, index: number): string {
  return `player-${teamUuid}-${index}`;
}
