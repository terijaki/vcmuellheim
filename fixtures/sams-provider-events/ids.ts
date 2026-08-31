import { SAMS } from "@project.config";

export const SEED_SEASON = { uuid: "season-vcm-2026-27", name: "2026/27" } as const;

const ASSOCIATION = { uuid: "assoc-sbvv", name: SAMS.association.name } as const;

export const SEED_VCM_CLUB = {
  uuid: "club-vc-muellheim",
  name: "VC Müllheim",
  shortName: "VC Müllheim",
  slug: "vc-muellheim",
  associationUuid: ASSOCIATION.uuid,
  associationName: ASSOCIATION.name,
  initials: "VM",
  color: "#366273",
} as const;

export const SEED_MGV_CLUB = {
  uuid: "club-markgraefler-volleys",
  name: "Markgräfler Volleys",
  shortName: "Markgräfler Volleys",
  slug: "markgraefler-volleys",
  associationUuid: ASSOCIATION.uuid,
  associationName: ASSOCIATION.name,
  initials: "MV",
  color: "#9B2226",
} as const;

export const SEED_TARGET_CLUBS = [SEED_VCM_CLUB, SEED_MGV_CLUB] as const;
export type SeedTargetClub = (typeof SEED_TARGET_CLUBS)[number];

export const SEED_VCM_TEAMS = [
  {
    uuid: "team-vcm-1",
    name: "VC Müllheim 1",
    slug: "vc-muellheim-1",
    leagueUuid: "league-vcm-landesliga",
    leagueName: "Landesliga",
    leagueHierarchyLevel: 3,
  },
  {
    uuid: "team-vcm-2",
    name: "VC Müllheim 2",
    slug: "vc-muellheim-2",
    leagueUuid: "league-vcm-verbandsliga",
    leagueName: "Verbandsliga",
    leagueHierarchyLevel: 4,
  },
  {
    uuid: "team-vcm-3",
    name: "VC Müllheim 3",
    slug: "vc-muellheim-3",
    leagueUuid: "league-vcm-bezirksliga",
    leagueName: "Bezirksliga",
    leagueHierarchyLevel: 5,
  },
] as const;

export const SEED_MGV_TEAMS = [
  {
    uuid: "team-mgv-1",
    name: "Markgräfler Volleys",
    slug: "markgraefler-volleys",
    leagueUuid: "league-mgv-landesliga",
    leagueName: "Landesliga",
    leagueHierarchyLevel: 3,
  },
  {
    uuid: "team-mgv-2",
    name: "Markgräfler Volleys 2",
    slug: "markgraefler-volleys-2",
    leagueUuid: "league-mgv-verbandsliga",
    leagueName: "Verbandsliga",
    leagueHierarchyLevel: 4,
  },
  {
    uuid: "team-mgv-3",
    name: "Markgräfler Volleys 3",
    slug: "markgraefler-volleys-3",
    leagueUuid: "league-mgv-bezirksliga",
    leagueName: "Bezirksliga",
    leagueHierarchyLevel: 5,
  },
] as const;

export const SEED_CLUB_TEAMS = {
  [SEED_VCM_CLUB.uuid]: SEED_VCM_TEAMS,
  [SEED_MGV_CLUB.uuid]: SEED_MGV_TEAMS,
} as const;

/** 90s-cartoon opponent clubs. `teamNumbers` mix 1–4 with `null` (no team number). */
export const SEED_OPPONENT_CLUBS = [
  {
    uuid: "club-opp-mighty-ducks",
    name: "Mighty Ducks",
    shortName: "Mighty Ducks",
    slug: "mighty-ducks",
    initials: "MD",
    color: "#2E86AB",
    teamNumbers: [1, 2],
  },
  {
    uuid: "club-opp-animaniacs",
    name: "Animaniacs",
    shortName: "Animaniacs",
    slug: "animaniacs",
    initials: "AW",
    color: "#E63946",
    teamNumbers: [null, 1, 2],
  },
  {
    uuid: "club-opp-rugrats",
    name: "Rugrats United",
    shortName: "Rugrats",
    slug: "rugrats-united",
    initials: "RU",
    color: "#F4A261",
    teamNumbers: [1, 3],
  },
  {
    uuid: "club-opp-dexter",
    name: "Dexter Lab",
    shortName: "Dexter Lab",
    slug: "dexter-lab",
    initials: "DL",
    color: "#7B2CBF",
    teamNumbers: [1],
  },
  {
    uuid: "club-opp-pinky-brain",
    name: "Pinky & Brain",
    shortName: "Pinky Brain",
    slug: "pinky-brain",
    initials: "PB",
    color: "#2A9D8F",
    teamNumbers: [2, 4],
  },
  {
    uuid: "club-opp-hey-arnold",
    name: "Hey Arnold VC",
    shortName: "Hey Arnold",
    slug: "hey-arnold-vc",
    initials: "HA",
    color: "#E9C46A",
    teamNumbers: [null],
  },
  {
    uuid: "club-opp-gargoyles",
    name: "Gargoyles",
    shortName: "Gargoyles",
    slug: "gargoyles",
    initials: "GG",
    color: "#264653",
    teamNumbers: [1, 2, 3],
  },
  {
    uuid: "club-opp-ninja-turtles",
    name: "Ninja Turtles",
    shortName: "Ninja Turtles",
    slug: "ninja-turtles",
    initials: "NT",
    color: "#2D6A4F",
    teamNumbers: [1, 2],
  },
  {
    uuid: "club-opp-team-rocket",
    name: "Team Rocket",
    shortName: "Team Rocket",
    slug: "team-rocket",
    initials: "TR",
    color: "#9B2226",
    teamNumbers: [null, 1],
  },
  {
    uuid: "club-opp-johnny-bravo",
    name: "Johnny Bravo",
    shortName: "Johnny Bravo",
    slug: "johnny-bravo",
    initials: "JB",
    color: "#FFB703",
    teamNumbers: [1, 4],
  },
  {
    uuid: "club-opp-recess",
    name: "Recess Rangers",
    shortName: "Recess",
    slug: "recess-rangers",
    initials: "RR",
    color: "#457B9D",
    teamNumbers: [2],
  },
  {
    uuid: "club-opp-rocko",
    name: "Rocko's Modern VC",
    shortName: "Rocko",
    slug: "rockos-modern-vc",
    initials: "RK",
    color: "#E76F51",
    teamNumbers: [1, 2, 3],
  },
] as const;

export function opponentTeamDisplayName(
  club: (typeof SEED_OPPONENT_CLUBS)[number],
  opponentIndex: number,
): string {
  const number = club.teamNumbers[opponentIndex % club.teamNumbers.length];
  return number == null ? club.shortName : `${club.shortName} ${number}`;
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
