import { makeApi, Zodios, type ZodiosOptions } from "@zodios/core";
import { z } from "zod";

type ValidationError = Partial<{
  violations: Array<ConstraintViolation>;
}>;
type ConstraintViolation = Partial<{
  constraint: string;
  property: string;
  entity: string;
  invalidValue: string;
  message: string;
}>;
type Association = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  shortname: string;
  parentUuid: string;
  level: number;
}>;
type Links = Partial<{
  empty: boolean;
}>;
type Embedded = Partial<{
  empty: boolean;
}>;
type HalRepresentation = Partial<{
  _links: Links;
  _embedded: Embedded;
}>;
type AssociationResourcePage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<Association>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type Committee = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  associationUuid: string;
  members: Array<CommitteeMember>;
  name: string;
  shortname: string;
  description: string;
  type: string;
  imageLink: string;
}>;
type CommitteeMember = Partial<{
  uuid: string;
  committeeUuid: string;
  additionalTitle: string;
  sourceFunction: string;
  description: string;
  firstName: string;
  lastName: string;
  email: string;
  priority: number;
  address: Address;
  phoneMobile: string;
  fax: string;
  phoneWork: string;
  faxWork: string;
  phoneMobileWork: string;
  portraitPhotoLink: string;
}>;
type Address = Partial<{
  street: string;
  postcode: string;
  city: string;
  country: string;
  extrafield: string;
  region: string;
  postbox: string;
}>;
type CommitteePage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<Committee>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type SportsclubDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  shortname: string;
  sportsclubNumber: number;
  associationUuid: string;
  logoImageLink: string;
}>;
type SportsclubPage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<SportsclubDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type LeagueHierarchyDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  shortName: string;
  seasonUuid: string;
  associationUuid: string;
  level: number;
  parentLeagueHierarchyUuid: string;
}>;
type LeagueHierarchyPage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<LeagueHierarchyDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type Location = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  longitude: number;
  latitude: number;
  address: Address;
}>;
type LocationResourcePage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<Location>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type CompetitionDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  shortName: string;
  gender: "MALE" | "FEMALE" | "MIXED";
  leagueHierarchyUuid: string;
  seasonUuid: string;
  associationUuid: string;
  superCompetitionUuid: string;
}>;
type CompetitionPage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<CompetitionDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type CompetitionMatchGroupRankingsDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  matchGroupName: string;
  rankings: Array<LeagueRankingsEntryDto>;
}>;
type LeagueRankingsEntryDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  teamName: string;
  rank: number;
  matchesPlayed: number;
  points: number;
  scoreIncludingLosses: string;
  wins: number;
  losses: number;
  setWins: number;
  setLosses: number;
  setDifference: number;
  setRatio: number;
  ballWins: number;
  ballLosses: number;
  ballDifference: number;
  ballRatio: number;
  resultTypes: Array<MatchResultTypeCount>;
}>;
type MatchResultTypeCount = Partial<{
  result: string;
  count: number;
}>;
type CompetitionRankingsResourcePage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<CompetitionMatchGroupRankingsDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type TeamDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  masterTeamUuid: string;
  name: string;
  shortName: string;
  teamNumber: number;
  clubCode: string;
  logoImageLink: string;
  sportsclubUuid: string;
  associationUuid: string;
}>;
type TeamPage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<TeamDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type CompetitionMatchDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  date: string;
  time: string;
  matchNumber: number;
  decidingMatch: boolean;
  gameReassessed: boolean;
  host: string;
  referees: RefereeTeamDto;
  spectators: number;
  netDuration: number;
  verified: boolean;
  location: Location;
  seasonUuid: string;
  associationUuid: string;
  results: VolleyballMatchResultsDto;
  matchGroupUuid: string;
  competitionUuid: string;
  delayPossible: boolean;
  indefinitelyRescheduled: boolean;
}>;
type RefereeTeamDto = Partial<{
  firstReferee: string;
  secondReferee: string;
  challengeReferee: string;
}>;
type VolleyballMatchResultsDto = Partial<{
  winner: string;
  winnerName: string;
  setPoints: string;
  ballPoints: string;
  sets: Array<VolleyballMatchSetRestDto>;
}>;
type VolleyballMatchSetRestDto = Partial<{
  number: number;
  ballPoints: string;
  winner: string;
  winnerName: string;
  duration: number;
}>;
type CompetitionMatchPage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<CompetitionMatchDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type CompetitionMatchGroupDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  tourneyLevel: number;
  seasonUuid: string;
  competitionUuid: string;
  associationUuid: string;
}>;
type CompetitionMatchGroupPage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<CompetitionMatchGroupDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type LeagueDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  shortName: string;
  gender: "MALE" | "FEMALE" | "MIXED";
  leagueHierarchyUuid: string;
  seasonUuid: string;
  associationUuid: string;
}>;
type LeaguePage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<LeagueDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type LeagueRankingsResourcePage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<LeagueRankingsEntryDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type LeagueMatchDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  date: string;
  time: string;
  matchNumber: number;
  decidingMatch: boolean;
  gameReassessed: boolean;
  host: string;
  referees: RefereeTeamDto;
  spectators: number;
  netDuration: number;
  verified: boolean;
  location: Location;
  seasonUuid: string;
  associationUuid: string;
  results: VolleyballMatchResultsDto;
  matchDayUuid: string;
  leagueUuid: string;
  delayPossible: boolean;
  indefinitelyRescheduled: boolean;
}>;
type LeagueMatchPage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<LeagueMatchDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type LeagueMatchDayDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  matchdate: string;
  seasonUuid: string;
  leagueUuid: string;
  associationUuid: string;
}>;
type LeagueMatchDayPage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<LeagueMatchDayDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type SuperCompetitionDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  shortName: string;
  gender: "MALE" | "FEMALE" | "MIXED";
  leagueHierarchyUuid: string;
  seasonUuid: string;
  associationUuid: string;
  superCompetitionUuid: string;
}>;
type SuperCompetitionPage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<SuperCompetitionDto>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type Event = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  shortname: string;
  eventNumber: number;
  overridingEventNumber: string;
  dateNotYetKnown: boolean;
  endsAt: string;
  beginsAt: string;
  registrationDeadline: string;
  associationUuid: string;
  canceled: boolean;
  minimumNumberOfParticipants: number;
  maximumNumberOfParticipants: number;
  usedCapacity: number;
  registrationUri: string;
  location: Location;
  eventTypeUuid: string;
}>;
type EventPage = Partial<{
  totalElements: number;
  numberOfElements: number;
  _links: Links;
  _embedded: Embedded;
  content: Array<Event>;
  empty: boolean;
  totalPages: number;
  first: boolean;
  last: boolean;
}>;
type EventType = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  description: string;
  category: string;
  associationUuid: string;
}>;
type SeasonDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  name: string;
  startDate: string;
  endDate: string;
  currentSeason: boolean;
}>;
type UserDetailsDto = Partial<{
  uuid: string;
  _links: Links;
  _embedded: Embedded;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "UNDEFINED" | "MALE" | "FEMALE" | "DIVERS";
  emailAddress: string;
  samsInstance: string;
  refsoftID: string;
}>;

const Links: z.ZodType<Links> = z
  .object({ empty: z.boolean() })
  .partial()
  .passthrough();
const Embedded: z.ZodType<Embedded> = z
  .object({ empty: z.boolean() })
  .partial()
  .passthrough();
const Association: z.ZodType<Association> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    shortname: z.string(),
    parentUuid: z.string(),
    level: z.number().int(),
  })
  .partial()
  .passthrough();
const ConstraintViolation: z.ZodType<ConstraintViolation> = z
  .object({
    constraint: z.string(),
    property: z.string(),
    entity: z.string(),
    invalidValue: z.string(),
    message: z.string(),
  })
  .partial()
  .passthrough();
const ValidationError: z.ZodType<ValidationError> = z
  .object({ violations: z.array(ConstraintViolation) })
  .partial()
  .passthrough();
const ResponseExceptionMessage = z
  .object({ message: z.string() })
  .partial()
  .passthrough();
const ResponseException = z
  .object({ exception: z.string(), message: z.string() })
  .partial()
  .passthrough();
const AssociationResourcePage: z.ZodType<AssociationResourcePage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(Association),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const Address: z.ZodType<Address> = z
  .object({
    street: z.string(),
    postcode: z.string(),
    city: z.string(),
    country: z.string(),
    extrafield: z.string(),
    region: z.string(),
    postbox: z.string(),
  })
  .partial()
  .passthrough();
const CommitteeMember: z.ZodType<CommitteeMember> = z
  .object({
    uuid: z.string(),
    committeeUuid: z.string(),
    additionalTitle: z.string(),
    sourceFunction: z.string(),
    description: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    email: z.string(),
    priority: z.number().int(),
    address: Address,
    phoneMobile: z.string(),
    fax: z.string(),
    phoneWork: z.string(),
    faxWork: z.string(),
    phoneMobileWork: z.string(),
    portraitPhotoLink: z.string(),
  })
  .partial()
  .passthrough();
const Committee: z.ZodType<Committee> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    associationUuid: z.string(),
    members: z.array(CommitteeMember),
    name: z.string(),
    shortname: z.string(),
    description: z.string(),
    type: z.string(),
    imageLink: z.string(),
  })
  .partial()
  .passthrough();
const CommitteePage: z.ZodType<CommitteePage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(Committee),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const SportsclubDto: z.ZodType<SportsclubDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    shortname: z.string(),
    sportsclubNumber: z.number().int(),
    associationUuid: z.string(),
    logoImageLink: z.string(),
  })
  .partial()
  .passthrough();
const SportsclubPage: z.ZodType<SportsclubPage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(SportsclubDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const HalRepresentation: z.ZodType<HalRepresentation> = z
  .object({ _links: Links, _embedded: Embedded })
  .partial()
  .passthrough();
const LeagueHierarchyDto: z.ZodType<LeagueHierarchyDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    shortName: z.string(),
    seasonUuid: z.string(),
    associationUuid: z.string(),
    level: z.number().int(),
    parentLeagueHierarchyUuid: z.string(),
  })
  .partial()
  .passthrough();
const LeagueHierarchyPage: z.ZodType<LeagueHierarchyPage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(LeagueHierarchyDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const Location: z.ZodType<Location> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    longitude: z.number(),
    latitude: z.number(),
    address: Address,
  })
  .partial()
  .passthrough();
const LocationResourcePage: z.ZodType<LocationResourcePage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(Location),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const CompetitionDto: z.ZodType<CompetitionDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    shortName: z.string(),
    gender: z.enum(["MALE", "FEMALE", "MIXED"]),
    leagueHierarchyUuid: z.string(),
    seasonUuid: z.string(),
    associationUuid: z.string(),
    superCompetitionUuid: z.string(),
  })
  .partial()
  .passthrough();
const CompetitionPage: z.ZodType<CompetitionPage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(CompetitionDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const MatchResultTypeCount: z.ZodType<MatchResultTypeCount> = z
  .object({ result: z.string(), count: z.number().int() })
  .partial()
  .passthrough();
const LeagueRankingsEntryDto: z.ZodType<LeagueRankingsEntryDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    teamName: z.string(),
    rank: z.number().int(),
    matchesPlayed: z.number().int(),
    points: z.number().int(),
    scoreIncludingLosses: z.string(),
    wins: z.number().int(),
    losses: z.number().int(),
    setWins: z.number().int(),
    setLosses: z.number().int(),
    setDifference: z.number().int(),
    setRatio: z.number(),
    ballWins: z.number().int(),
    ballLosses: z.number().int(),
    ballDifference: z.number().int(),
    ballRatio: z.number(),
    resultTypes: z.array(MatchResultTypeCount),
  })
  .partial()
  .passthrough();
const CompetitionMatchGroupRankingsDto: z.ZodType<CompetitionMatchGroupRankingsDto> =
  z
    .object({
      uuid: z.string(),
      _links: Links,
      _embedded: Embedded,
      matchGroupName: z.string(),
      rankings: z.array(LeagueRankingsEntryDto),
    })
    .partial()
    .passthrough();
const CompetitionRankingsResourcePage: z.ZodType<CompetitionRankingsResourcePage> =
  z
    .object({
      totalElements: z.number().int(),
      numberOfElements: z.number().int(),
      _links: Links,
      _embedded: Embedded,
      content: z.array(CompetitionMatchGroupRankingsDto),
      empty: z.boolean(),
      totalPages: z.number().int(),
      first: z.boolean(),
      last: z.boolean(),
    })
    .partial()
    .passthrough();
const TeamDto: z.ZodType<TeamDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    masterTeamUuid: z.string(),
    name: z.string(),
    shortName: z.string(),
    teamNumber: z.number().int(),
    clubCode: z.string(),
    logoImageLink: z.string(),
    sportsclubUuid: z.string(),
    associationUuid: z.string(),
  })
  .partial()
  .passthrough();
const TeamPage: z.ZodType<TeamPage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(TeamDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const RefereeTeamDto: z.ZodType<RefereeTeamDto> = z
  .object({
    firstReferee: z.string(),
    secondReferee: z.string(),
    challengeReferee: z.string(),
  })
  .partial()
  .passthrough();
const VolleyballMatchSetRestDto: z.ZodType<VolleyballMatchSetRestDto> = z
  .object({
    number: z.number().int(),
    ballPoints: z.string(),
    winner: z.string(),
    winnerName: z.string(),
    duration: z.number().int(),
  })
  .partial()
  .passthrough();
const VolleyballMatchResultsDto: z.ZodType<VolleyballMatchResultsDto> = z
  .object({
    winner: z.string(),
    winnerName: z.string(),
    setPoints: z.string(),
    ballPoints: z.string(),
    sets: z.array(VolleyballMatchSetRestDto),
  })
  .partial()
  .passthrough();
const CompetitionMatchDto: z.ZodType<CompetitionMatchDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    date: z.string().datetime({ offset: true }),
    time: z.string(),
    matchNumber: z.number().int(),
    decidingMatch: z.boolean(),
    gameReassessed: z.boolean(),
    host: z.string(),
    referees: RefereeTeamDto,
    spectators: z.number().int(),
    netDuration: z.number().int(),
    verified: z.boolean(),
    location: Location,
    seasonUuid: z.string(),
    associationUuid: z.string(),
    results: VolleyballMatchResultsDto,
    matchGroupUuid: z.string(),
    competitionUuid: z.string(),
    delayPossible: z.boolean(),
    indefinitelyRescheduled: z.boolean(),
  })
  .partial()
  .passthrough();
const CompetitionMatchPage: z.ZodType<CompetitionMatchPage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(CompetitionMatchDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const CompetitionMatchGroupDto: z.ZodType<CompetitionMatchGroupDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    tourneyLevel: z.number().int(),
    seasonUuid: z.string(),
    competitionUuid: z.string(),
    associationUuid: z.string(),
  })
  .partial()
  .passthrough();
const CompetitionMatchGroupPage: z.ZodType<CompetitionMatchGroupPage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(CompetitionMatchGroupDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const LeagueDto: z.ZodType<LeagueDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    shortName: z.string(),
    gender: z.enum(["MALE", "FEMALE", "MIXED"]),
    leagueHierarchyUuid: z.string(),
    seasonUuid: z.string(),
    associationUuid: z.string(),
  })
  .partial()
  .passthrough();
const LeaguePage: z.ZodType<LeaguePage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(LeagueDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const LeagueRankingsResourcePage: z.ZodType<LeagueRankingsResourcePage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(LeagueRankingsEntryDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const LeagueMatchDto: z.ZodType<LeagueMatchDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    date: z.string().datetime({ offset: true }),
    time: z.string(),
    matchNumber: z.number().int(),
    decidingMatch: z.boolean(),
    gameReassessed: z.boolean(),
    host: z.string(),
    referees: RefereeTeamDto,
    spectators: z.number().int(),
    netDuration: z.number().int(),
    verified: z.boolean(),
    location: Location,
    seasonUuid: z.string(),
    associationUuid: z.string(),
    results: VolleyballMatchResultsDto,
    matchDayUuid: z.string(),
    leagueUuid: z.string(),
    delayPossible: z.boolean(),
    indefinitelyRescheduled: z.boolean(),
  })
  .partial()
  .passthrough();
const LeagueMatchPage: z.ZodType<LeagueMatchPage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(LeagueMatchDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const LeagueMatchDayDto: z.ZodType<LeagueMatchDayDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    matchdate: z.string().datetime({ offset: true }),
    seasonUuid: z.string(),
    leagueUuid: z.string(),
    associationUuid: z.string(),
  })
  .partial()
  .passthrough();
const LeagueMatchDayPage: z.ZodType<LeagueMatchDayPage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(LeagueMatchDayDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const SuperCompetitionDto: z.ZodType<SuperCompetitionDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    shortName: z.string(),
    gender: z.enum(["MALE", "FEMALE", "MIXED"]),
    leagueHierarchyUuid: z.string(),
    seasonUuid: z.string(),
    associationUuid: z.string(),
    superCompetitionUuid: z.string(),
  })
  .partial()
  .passthrough();
const SuperCompetitionPage: z.ZodType<SuperCompetitionPage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(SuperCompetitionDto),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const Event: z.ZodType<Event> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    shortname: z.string(),
    eventNumber: z.number().int(),
    overridingEventNumber: z.string(),
    dateNotYetKnown: z.boolean(),
    endsAt: z.string().datetime({ offset: true }),
    beginsAt: z.string().datetime({ offset: true }),
    registrationDeadline: z.string().datetime({ offset: true }),
    associationUuid: z.string(),
    canceled: z.boolean(),
    minimumNumberOfParticipants: z.number().int(),
    maximumNumberOfParticipants: z.number().int(),
    usedCapacity: z.number().int(),
    registrationUri: z.string().url(),
    location: Location,
    eventTypeUuid: z.string(),
  })
  .partial()
  .passthrough();
const EventPage: z.ZodType<EventPage> = z
  .object({
    totalElements: z.number().int(),
    numberOfElements: z.number().int(),
    _links: Links,
    _embedded: Embedded,
    content: z.array(Event),
    empty: z.boolean(),
    totalPages: z.number().int(),
    first: z.boolean(),
    last: z.boolean(),
  })
  .partial()
  .passthrough();
const EventType: z.ZodType<EventType> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    description: z.string(),
    category: z.string(),
    associationUuid: z.string(),
  })
  .partial()
  .passthrough();
const SeasonDto: z.ZodType<SeasonDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    name: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    currentSeason: z.boolean(),
  })
  .partial()
  .passthrough();
const UserDetailsDto: z.ZodType<UserDetailsDto> = z
  .object({
    uuid: z.string(),
    _links: Links,
    _embedded: Embedded,
    firstName: z.string(),
    lastName: z.string(),
    dateOfBirth: z.string().datetime({ offset: true }),
    gender: z.enum(["UNDEFINED", "MALE", "FEMALE", "DIVERS"]),
    emailAddress: z.string(),
    samsInstance: z.string(),
    refsoftID: z.string(),
  })
  .partial()
  .passthrough();

export const schemas = {
  Links,
  Embedded,
  Association,
  ConstraintViolation,
  ValidationError,
  ResponseExceptionMessage,
  ResponseException,
  AssociationResourcePage,
  Address,
  CommitteeMember,
  Committee,
  CommitteePage,
  SportsclubDto,
  SportsclubPage,
  HalRepresentation,
  LeagueHierarchyDto,
  LeagueHierarchyPage,
  Location,
  LocationResourcePage,
  CompetitionDto,
  CompetitionPage,
  MatchResultTypeCount,
  LeagueRankingsEntryDto,
  CompetitionMatchGroupRankingsDto,
  CompetitionRankingsResourcePage,
  TeamDto,
  TeamPage,
  RefereeTeamDto,
  VolleyballMatchSetRestDto,
  VolleyballMatchResultsDto,
  CompetitionMatchDto,
  CompetitionMatchPage,
  CompetitionMatchGroupDto,
  CompetitionMatchGroupPage,
  LeagueDto,
  LeaguePage,
  LeagueRankingsResourcePage,
  LeagueMatchDto,
  LeagueMatchPage,
  LeagueMatchDayDto,
  LeagueMatchDayPage,
  SuperCompetitionDto,
  SuperCompetitionPage,
  Event,
  EventPage,
  EventType,
  SeasonDto,
  UserDetailsDto,
};

const endpoints = makeApi([
  {
    method: "get",
    path: "/",
    alias: "getApiBaseLinks",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/associations",
    alias: "getAssociations",
    description: `Returns all available association as a paged list. The default page size is 20. The page size must not be greater than 100`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: AssociationResourcePage,
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: ValidationError,
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.object({ message: z.string() }).partial().passthrough(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.object({ message: z.string() }).partial().passthrough(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: ResponseException,
      },
    ],
  },
  {
    method: "get",
    path: "/associations/:uuid",
    alias: "getAssociationByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: Association,
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: ValidationError,
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.object({ message: z.string() }).partial().passthrough(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.object({ message: z.string() }).partial().passthrough(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: ResponseException,
      },
    ],
  },
  {
    method: "get",
    path: "/associations/:uuid/committees",
    alias: "getCommitteesForAssociation",
    description: `Returns the list of committees for an association as a paged list. The default page size is The returned committees list their respective members including the members&#x27; publicly available contact information.20. The page size must not be greater than 100`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: CommitteePage,
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: ValidationError,
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.object({ message: z.string() }).partial().passthrough(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.object({ message: z.string() }).partial().passthrough(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: ResponseException,
      },
    ],
  },
  {
    method: "get",
    path: "/associations/:uuid/sportsclubs",
    alias: "getSportsclubsForAssociation",
    description: `Returns the list of sportsclubs belonging to the association identified by the specified UUID as a paged list. The default page size is 20. The page size must not be greater than 100`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: SportsclubPage,
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: ValidationError,
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.object({ message: z.string() }).partial().passthrough(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.object({ message: z.string() }).partial().passthrough(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: ResponseException,
      },
    ],
  },
  {
    method: "get",
    path: "/committees",
    alias: "getAllCommittees",
    description: `Returns all committees belonging to the association which can be accessed with the used API key. The returned committees list their respective members including the members&#x27; publicly available contact information. The default page size is 20. The page size must not be greater than 100`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/committees/:uuid",
    alias: "getCommittee",
    description: `Returns the requested committee if it belongs to the association which can be accessed with the used API key. The returned committee lists its respective members including the members&#x27; publicly available contact information.`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/competition-matches",
    alias: "getAllCompetitionMatchesWithFilter",
    description: `The default page size is 20. The page size must not be greater than 100. The result list can be filtered for a particular season, competition, sports club, or team by passing the UUID of the entity for which to filter as a filter query parameter. The filters will be combined with AND semantics.`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "for-season",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "for-competition",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "for-sportsclub",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "for-team",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/competition-matches/:uuid",
    alias: "getCompetitionMatchByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/competitions",
    alias: "getAllCompetitions",
    description: `The default page size is 20. The page size must not be greater than 100`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/competitions/:uuid",
    alias: "getCompetitionByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/competitions/:uuid/match-groups",
    alias: "getMatchGroupsForCompetition",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/competitions/:uuid/rankings",
    alias: "getRankingsForCompetition",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/competitions/:uuid/teams",
    alias: "getTeamsForCompetition",
    description: `The default page size is 20. The page size must not be greater than 100`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/event-types",
    alias: "getEventTypes",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/event-types/:uuid",
    alias: "getEventTypeByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/events",
    alias: "getAllEvents",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/events/:uuid",
    alias: "getEventByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/league-hierarchies",
    alias: "getAllLeagueHierarchies",
    description: `The default page size is 20. The page size must not be greater than 100. The result list can be filtered for a particular season.`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "for-season",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/league-hierarchies/:uuid",
    alias: "getLeagueHierarchyByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/league-hierarchies/:uuid/competitions",
    alias: "getCompetitionsByLeagueHierarchy",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/league-hierarchies/:uuid/leagues",
    alias: "getLeaguesByLeagueHierarchy",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/league-hierarchies/:uuid/super-competitions",
    alias: "getSuperCompetitionsByLeagueHierarchy",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/league-matches",
    alias: "getAllLeagueMatches",
    description: `The default page size is 20. The page size must not be greater than 100. The result list can be filtered for a particular season, league, sports club, or team by passing the UUID of the entity for which to filter as a filter query parameter. The filters will be combined with AND semantics.`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "for-season",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "for-league",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "for-sportsclub",
        type: "Query",
        schema: z.string().optional(),
      },
      {
        name: "for-team",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/league-matches/:uuid",
    alias: "getLeagueMatchByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/leagues",
    alias: "getAllLeagues",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/leagues/:uuid",
    alias: "getLeagueByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/leagues/:uuid/match-days",
    alias: "getMatchDaysForLeague",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/leagues/:uuid/rankings",
    alias: "getRankingsForLeague",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/leagues/:uuid/teams",
    alias: "getTeamsForLeague",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/locations",
    alias: "getAllLocations",
    description: `The default page size is 20. The page size must not be greater than 100`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/locations/:uuid",
    alias: "getLocationByUuid",
    description: `Returns a location element identified by the given UUID`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/match-days",
    alias: "getAllMatchDays",
    description: `The default page size is 20. The page size must not be greater than 100`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/match-days/:uuid",
    alias: "getMatchDayByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/match-days/:uuid/league-matches",
    alias: "getMatchesByMatchDay",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/match-groups",
    alias: "getAllMatchGroups",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/match-groups/:uuid",
    alias: "getMatchGroupByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/match-groups/:uuid/competition-matches",
    alias: "getMatchesByMatchGroup",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/seasons",
    alias: "getAllSeasons",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/seasons/:uuid",
    alias: "getSeasonByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/seasons/:uuid/league-hierarchies",
    alias: "getLeagueHierarchiesForSeason",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/sportsclubs",
    alias: "getAllSportsclubs",
    description: `The default page size is 20. The page size must not be greater than 100`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/sportsclubs/:uuid",
    alias: "getSportsclub",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/super-competitions",
    alias: "getAllSuperCompetitions",
    description: `The default page size is 20. The page size must not be greater than 100. The sub-competitions belonging to each super competition are added as an _embedded entity list.`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/super-competitions/:uuid",
    alias: "getSuperCompetitionByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/teams",
    alias: "getAllTeams",
    description: `The default page size is 20. The page size must not be greater than 100`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "page",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "size",
        type: "Query",
        schema: z.number().int().optional(),
      },
      {
        name: "association",
        type: "Query",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/teams/:uuid",
    alias: "getTeamByUuid",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
      {
        name: "uuid",
        type: "Path",
        schema: z.string(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/user-details",
    alias: "userDetailsRootLinks",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
  {
    method: "get",
    path: "/user-details/current",
    alias: "getCurrentUser",
    requestFormat: "json",
    parameters: [
      {
        name: "X-Api-Key",
        type: "Header",
        schema: z.string().optional(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `POST only: A violation occurred while validating the processed request data, for example caused by an invalid email address. Check the response for further details.`,
        schema: z.void(),
      },
      {
        status: 403,
        description: `API authorization failed.`,
        schema: z.void(),
      },
      {
        status: 409,
        description: `The request could not be processed due to invalid request data. Check the response for more details.`,
        schema: z.void(),
      },
      {
        status: 500,
        description: `An unexpected error occurred. Please contact support and supply the response data.`,
        schema: z.void(),
      },
    ],
  },
]);

export const sams = new Zodios(
  "https://www.volleyball-baden.de/api/v2/",
  endpoints
);

export function createApiClient(baseUrl: string, options?: ZodiosOptions) {
  return new Zodios(baseUrl, endpoints, options);
}
