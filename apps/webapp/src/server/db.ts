/**
 * Server-side database access for webapp server functions.
 * Re-exports all repositories and query helpers from the shared lib.
 * The lib/db/client.ts uses Powertools tracer which gracefully degrades
 * to a no-op when not running inside Lambda (local dev / non-Lambda runtime).
 */

export { docClient } from "@/lib/db/client";
export {
	authVerificationsRepository,
	busRepository,
	cmsUsersRepository,
	createAuthVerification,
	eventsRepository,
	getAllCmsUsers,
	getAllLocations,
	getAllMembers,
	// Query helpers
	getAllNews,
	getAllSamsClubs,
	getAllSamsTeams,
	getAllSponsors,
	getAllTeams,
	getAuthVerificationById,
	getAuthVerificationByIdentifier,
	getBoardMembers,
	getCmsUserByEmail,
	getNewsBySlug,
	getPublishedNews,
	getSamsClubByNameSlug,
	getSamsClubBySportsclubUuid,
	getSamsTeamByUuid,
	getTeamBySlug,
	getTrainers,
	getUpcomingEvents,
	locationsRepository,
	mediaRepository,
	membersRepository,
	newsRepository,
	samsClubsRepository,
	samsTeamsRepository,
	sponsorsRepository,
	teamsRepository,
} from "@/lib/db/repositories";
export { busSchema, eventSchema, locationSchema, mediaSchema, memberSchema, newsSchema, sponsorSchema, teamSchema } from "@/lib/db/schemas";

export type { AuthVerification, Bus, CmsUser, Event, Location, Media, Member, News, Sponsor, Team } from "@/lib/db/types";
