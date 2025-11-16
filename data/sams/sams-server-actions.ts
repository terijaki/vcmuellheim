"server-only";
import dayjs from "dayjs";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { payload } from "@/data/payload-client";
import type { SamsClub, SamsTeam } from "@/data/payload-types";
import {
	type Association,
	getAllLeagueMatches,
	getAllLeagues,
	getAllSeasons,
	getAllSportsclubs,
	getAssociations,
	getRankingsForLeague,
	getTeamsForLeague,
	type LeagueDto,
	type LeagueMatchDto,
	type LeagueRankingsResourcePage,
	type SeasonDto,
} from "@/data/sams/client";
import { SAMS } from "@/project.config";
import { getSamsClubByName } from "../samsClubs";
import { getOurClubsSamsTeams } from "../samsTeams";

// API KEY and SERVER URL should be set via env variables!!

/** Cache settings for real-time data such as league **rankings** and **match results** */
const REALTIME_CACHE = {
	stale: 30, // 30 seconds
	revalidate: 60, // 1 minute
	expire: 60, // 1 minute
};
/** Cache settings for non-real-time data such as league **associations** */
const NON_REALTIME_CACHE = {
	stale: 60 * 60, // 1 hour
	revalidate: 60 * 15, // 15 minutes
	expire: 60 * 60 * 12, // 12 hours
};

export type Ranking = {
	teams: LeagueRankingsResourcePage["content"];
	timestamp: Date;
	leagueUuid: string;
	leagueName?: string | null;
	seasonName?: string | null;
};
export async function samsLeagueRanking(leagueUuid: string, leagueName?: string | null, seasonName?: string | null): Promise<Ranking | undefined> {
	"use cache";
	cacheLife(REALTIME_CACHE);

	try {
		const { data } = await getRankingsForLeague({
			throwOnError: true,
			path: { uuid: leagueUuid },
			query: { page: 0, size: 100 }, // no need to paginate there is no ranking with more than 100 teams
			headers: {
				"X-API-Key": process.env.SAMS_API_KEY,
			},
		});
		if (data?.content) return { teams: data.content, timestamp: new Date(), leagueUuid, leagueName, seasonName };
	} catch (error) {
		console.error(`🚨 Error fetching rankings for leagueUuid ${leagueUuid}: `, error);
	}
}

type SeasonsResponse = {
	current: SeasonDto[number];
	next: SeasonDto[number] | undefined;
	previous: SeasonDto[number] | undefined;
};
export async function samsSeasons(): Promise<SeasonsResponse | undefined> {
	"use cache";
	cacheLife(NON_REALTIME_CACHE);

	try {
		const { data: seasons } = await getAllSeasons({ throwOnError: true });

		const currentSeason = seasons.find((s) => s.currentSeason);
		const nextSeason = seasons.find((s) => dayjs(s.startDate).subtract(1, "day").isSame(currentSeason?.endDate));
		const previousSeason = seasons.find((s) => dayjs(s.endDate).add(1, "day").isSame(currentSeason?.startDate));

		if (!currentSeason) return undefined;

		const response = { current: currentSeason, next: nextSeason, previous: previousSeason };

		return response;
	} catch (error) {
		console.error("🚨 Error fetching seasons", error);
	}
}

export async function samsAssociation(name: string): Promise<Association | undefined> {
	"use cache";
	cacheLife(NON_REALTIME_CACHE);

	try {
		const allAssociations: Association[] = [];
		let currentPage = 0;
		let hasMorePages = true;

		// Continue fetching until no more pages
		while (hasMorePages) {
			const { data, error, response } = await getAssociations({
				query: { page: currentPage, size: 100 },
				headers: {
					"X-API-Key": process.env.SAMS_API_KEY,
				},
			});
			if (error) {
				throw new Error(`Error ${response.status} fetching associations page ${currentPage}`);
			}
			if (data.content) {
				allAssociations.push(...data.content);
				currentPage++;
			}
			if (data.last === true) hasMorePages = false;
		}

		const desiredAssociation = allAssociations.find((a) => a.name.toLowerCase() === name.toLowerCase());

		return desiredAssociation;
	} catch (error) {
		console.error("🚨 Error fetching associations", error);
	}
}

export type LeagueMatches = { matches: Omit<LeagueMatchDto, "_links">[]; timestamp: Date };
/** By default returns the matches of the club for the current season. */
export async function samsLeagueMatches(props: {
	league?: string;
	season?: string;
	sportsclub?: string;
	team?: string;
	limit?: number; // limit the number of matches to fetch, default is 100. disables pagination
	range?: "future" | "past";
}): Promise<LeagueMatches | undefined> {
	"use cache";
	cacheLife(REALTIME_CACHE);

	try {
		// Default parameters for the API calls
		const defaultQueryParams = {
			"for-league": props.league,
			"for-season": props.season,
			"for-sportsclub": props.sportsclub,
			"for-team": props.team,
		};
		if (defaultQueryParams["for-sportsclub"] === undefined) {
			const sportsClubResponse = await getSamsClubByName(SAMS.name);
			defaultQueryParams["for-sportsclub"] = sportsClubResponse?.sportsclubUuid;
		}
		if (defaultQueryParams["for-season"] === undefined) {
			const seasons = await samsSeasons();
			defaultQueryParams["for-season"] = seasons?.current.uuid;
		}

		// Array to hold all fetched sports clubs
		const allMatches: LeagueMatches["matches"] = [];
		let currentPage = 0;
		let hasMorePages = true;

		// Continue fetching until no more pages
		while (hasMorePages) {
			const { data, error, response } = await getAllLeagueMatches({
				query: {
					...defaultQueryParams,
					page: currentPage,
				},
				headers: {
					"X-API-Key": process.env.SAMS_API_KEY,
				},
			});

			if (error) {
				throw new Error(`Warning: Error ${response.status} fetching matches page ${currentPage}: ${error}`);
			}

			if (data.content) {
				const matches = data.content.map((m) => {
					// drop _links properties
					const { _links, ...match } = m;
					return match;
				});
				allMatches.push(...matches);
				currentPage++;
			}

			if (data.last === true || (props.limit && allMatches.length >= props.limit)) hasMorePages = false;
		}

		let filteredMatches = allMatches;
		if (props.range === "future") {
			// filter matches by future dates
			// filteredMatches = allMatches.filter((m) => dayjs(m.date).isAfter(dayjs()));
			// filter matches by absent winner
			filteredMatches = allMatches.filter((m) => !m.results?.winner);
		} else if (props.range === "past") {
			// filter matches by past dates
			filteredMatches = allMatches.filter((m) => dayjs(m.date).isBefore(dayjs()));
		}

		// sort matches by date (default sorting is by game number but does not take into account reschedules)
		if (props.range === "future") {
			filteredMatches.sort((a, b) => {
				return dayjs(a.date).diff(dayjs(b.date));
			});
		}
		if (props.range === "past") {
			filteredMatches.sort((a, b) => {
				return dayjs(b.date).diff(dayjs(a.date));
			});
		}

		// limit the number of matches to the specified limit
		if (props.limit) {
			filteredMatches = filteredMatches.slice(0, props.limit);
		}

		return { matches: filteredMatches, timestamp: new Date() };
	} catch (error) {
		console.error("🚨 Error fetching league matches", error);
	}
	return { matches: [], timestamp: new Date() };
}

/** returns the unique rankings for the club */
export async function samsClubRankings(): Promise<Ranking[] | undefined> {
	"use cache";
	cacheLife(REALTIME_CACHE);
	try {
		type teamData = {
			leagueUuid?: string;
			leagueName?: string | null;
			seasonUuid?: string | null;
			seasonName?: string | null;
		};
		const unqiueLeagues = new Map<string, teamData>();

		// get all our teams and then filter their league IDs
		const teams = await getOurClubsSamsTeams();
		if (!teams) throw "No club teams found";
		for (const team of teams) {
			if (team.leagueUuid)
				unqiueLeagues.set(team.leagueUuid, {
					leagueUuid: team.leagueUuid,
					leagueName: team.leagueName,
					seasonUuid: team.seasonUuid,
					seasonName: team.seasonName,
				});
		}
		if (!unqiueLeagues) throw "No league ID found in our teams.";

		// collect rankings for leagues
		const rankings: Ranking[] = [];
		for (const league of unqiueLeagues) {
			const ranking = await samsLeagueRanking(league[0], league[1].leagueName, league[1].seasonName);
			if (ranking) rankings.push(ranking);
		}

		// sort rankings by hierarchyLevel
		// TODO fix this. it is no longer possible since the ranking do not have any league info
		rankings.reverse(); // workaround for the missing hierarchyLevel in the rankings. not very accurate but assumes the highest team is added first
		// rankings.sort((a, b) => {
		// 	const hierarchyLevelA = a.matchSeries.hierarchy?.hierarchyLevel || 999;
		// 	const hierarchyLevelB = b.matchSeries.hierarchy?.hierarchyLevel || 999;
		// 	return hierarchyLevelA - hierarchyLevelB;
		// });

		return rankings;
	} catch (error) {
		console.error("🚨 Error fetching club rankings:", error);
	}
}

// Cron funciton to update Sams Teams in the payload database
export async function cronSamsTeamsViaLeaguesUpdate() {
	"use cache";
	cacheLife(NON_REALTIME_CACHE);
	// THIS IS A WORKAROUND
	// As of 06.06.2025 the teams object does not contain league informations. So we have to loop through each league and while doing so we can memorize the league and season information.

	// get association
	// get current season
	// get leagues for the association and filter by current season
	// get teams for each league
	// store each team

	try {
		// Default parameters for the API calls
		const defaultParams = {
			query: {
				page: 0,
				size: 100,
			},
			headers: {
				"X-API-Key": process.env.SAMS_API_KEY || "",
			},
		};

		// GET THE CLUB ID FROM PAYLOAD
		console.info("🔍 Identify association ID from stored club.");
		const clubData = await getSamsClubByName(SAMS.name);
		const { sportsclubUuid, associationUuid } = clubData || {};
		if (!sportsclubUuid) throw "🚨 No sportsclubUuid found in clubData";
		if (!associationUuid) throw "🚨 No associationUuid found in clubData";

		// GET THE CURRENT SEASON
		const seasons = await samsSeasons();
		const currentSeason = seasons?.current;

		// GET LEAGUES FOR THE ASSOCIATION
		console.info(`🔁 Fetch leagues for Association ${associationUuid}`);
		const allLeagues: LeagueDto[] = [];
		let leagueCurrentPage = 0;
		let leagueHasMorePages = true;
		while (leagueHasMorePages) {
			const { data, error, response } = await getAllLeagues({
				...defaultParams,
				query: {
					association: associationUuid,
					page: leagueCurrentPage,
				},
			});
			if (error) {
				throw new Error(`Error ${response.status} fetching associations page ${leagueCurrentPage}`);
			}
			if (data.content) {
				// filter leagues by current season
				const filteredLeagues = data.content.filter((l) => l.seasonUuid === currentSeason?.uuid);
				allLeagues.push(...filteredLeagues);
				leagueCurrentPage++;
			}
			if (data.last === true) leagueHasMorePages = false;
			// Wait an arbitrary second before continuing to next page to avoid rate limiting
			console.info(`📄 Fetched league page ${leagueCurrentPage} of ${data.totalPages}, continuing to next page...`);
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		// GET ALL TEAMS
		// Define the type for the team data without the pagination
		type Team = {
			uuid?: string;
			name?: string;
			sportsclubUuid?: string | null;
			associationUuid?: string | null;
			leagueUuid?: string | null;
			leagueName?: string | null;
		};
		const allTeams: Team[] = []; // Array to hold all fetched teams

		// GET TEAMS FOR EACH LEAGUE
		for (const league of allLeagues) {
			let teamsCurrentPage = 0;
			let teamsHasMorePages = true;
			// Continue fetching until no more pages
			while (teamsHasMorePages) {
				if (!league.uuid) throw `🚨 League UUID is missing: ${JSON.stringify(league)}`;
				const {
					data,
					error: pageError,
					response: pageResponse,
				} = await getTeamsForLeague({
					...defaultParams,
					query: { ...defaultParams.query, page: teamsCurrentPage },
					path: { uuid: league.uuid },
				});
				if (pageError) {
					throw new Error(`Warning: Error ${pageResponse.status} fetching team page ${teamsCurrentPage}: ${pageError}`);
				}
				if (data.content) {
					// filter out sub teams (e.g. tournament teams)
					const filteredTeams = data.content.filter((t) => !t.masterTeamUuid);
					// filter by our club
					const ourTeams = filteredTeams.filter((t) => t.sportsclubUuid === sportsclubUuid);
					const teams = ourTeams.map((t) => {
						return {
							name: t.name,
							uuid: t.uuid,
							sportsclubUuid: t.sportsclubUuid,
							associationUuid: t.associationUuid,
							leagueUuid: league.uuid,
							leagueName: league.name,
						};
					});
					allTeams.push(...teams);
					teamsCurrentPage++;
				}
				if (data.last === true) teamsHasMorePages = false;
				// Wait an arbitrary second before continuing to next page to avoid rate limiting
				console.info(`📄 Fetched ${league.name}'s teams page ${teamsCurrentPage} of ${data.totalPages}, continuing to next page or league...`);
				await new Promise((resolve) => setTimeout(resolve, 500));
			}
		}

		// UPDATE OUR TEAMS IN PAYLOAD - CRUD
		// prepare arrays to store the results of the update
		let teamsDeleted = 0;
		let teamsUpdated = 0;
		let teamsCreated = 0;
		// loop through all teams and update or create them in the database
		for (const team of allTeams) {
			// skip if name or id is missing
			if (!team.name || !team.uuid) continue;
			// build the payload object
			const payloadObject = {
				name: team.name,
				uuid: team.uuid,
				leagueUuid: team.leagueUuid,
				leagueName: team.leagueName,
				associationUuid: team.associationUuid,
				sportsclubUuid: team.sportsclubUuid,
				seasonUuid: currentSeason?.uuid,
				seasonName: currentSeason?.name,
			};
			// check if we have the team stored to determine if we need to update or create
			const cachedData = await payload.find({
				collection: "sams-teams",
				where: {
					uuid: {
						equals: team.uuid,
					},
				},
				select: { uuid: true }, // we only need the uuid for comparison
			});
			const cachedTeam = cachedData?.docs[0] as SamsTeam | undefined;
			// if we have the cached team, then update it, otherwise create it
			if (cachedTeam) {
				console.info(`🔄 Updating team: ${team.uuid} (${team.name})`);
				await payload.update({
					collection: "sams-teams",
					id: cachedTeam.id,
					data: payloadObject,
				});
				teamsUpdated++;
			} else {
				console.info(`🌱 Creating team: ${team.uuid} (${team.name})`);
				await payload.create({
					collection: "sams-teams",
					data: payloadObject,
				});
				teamsCreated++;
			}
		}
		// delete teams that were not updated recently
		const deletedTeams = await payload.delete({
			collection: "sams-teams",
			where: {
				updatedAt: {
					less_than: new Date(Date.now() - 1000 * 60 * 60), // delete teams that were not updated in the last 60 minutes
				},
			},
		});
		for (const team of deletedTeams.docs) {
			console.info(`🗑️ Deleted ${team.name} because they were no longer on SAMS`);
			teamsDeleted++;
		}

		return { created: teamsCreated, updated: teamsUpdated, deleted: teamsDeleted };
	} catch (error) {
		console.error("🚨 Error updating Sams Teams:", error);
	}
}
// Cron funciton to update Sams Teams in the payload database
// async function cronSamsTeamsUpdate() {
// 	// As of 06.06.2025 the teams object does not contain league informations. So we have to loop through each league and while doing so we can memorize the league and season information.
// 	try {
// 		// get the club id from payload
// 		const clubData = await getSamsClubByName(SAMS.name);
// 		const { sportsclubUuid, associationUuid } = clubData || {};
// 		if (!sportsclubUuid || !associationUuid) throw "🚨 No sportsclubUuid found in clubData";

// 		// Default parameters for the API calls
// 		const defaultParams = {
// 			query: {
// 				association: associationUuid,
// 				page: 0,
// 				size: 100,
// 			},
// 			headers: {
// 				"X-API-Key": process.env.SAMS_API_KEY || "",
// 			},
// 		};

// 		// Define the type for the team data without the pagination
// 		type Team = {
// 			uuid?: string;
// 			name?: string;
// 			leagueUuid?: string | null;
// 			sportsclubUuid?: string | null;
// 			associationUuid?: string | null;
// 		};

// 		// Array to hold all fetched teams
// 		const allData: Team[] = [];
// 		let currentPage = 0;
// 		let hasMorePages = true;

// 		// Continue fetching until no more pages
// 		while (hasMorePages) {
// 			const {
// 				data: pageData,
// 				error: pageError,
// 				response: pageResponse,
// 			} = await getAllTeams({
// 				...defaultParams,
// 				query: { ...defaultParams.query, page: currentPage },
// 			});

// 			if (pageError) {
// 				throw new Error(`Warning: Error ${pageResponse.status} fetching team page ${currentPage}: ${pageError}`);
// 			}

// 			if (pageData.content) {
// 				const filteredTeams = pageData.content.filter((t) => t.sportsclubUuid === sportsclubUuid);
// 				const teams = filteredTeams.map((t) => {
// 					return {
// 						name: t.name,
// 						uuid: t.uuid,
// 						leagueUuid: undefined, // TODO include once SAMS enhanced their API
// 						sportsclubUuid: t.sportsclubUuid,
// 						associationUuid: t.associationUuid,
// 					};
// 				});
// 				allData.push(...teams);
// 				currentPage++;
// 			}

// 			if (pageData.last === true) hasMorePages = false;
// 			// Wait an arbitrary second before continuing to next page
// 			console.info(`📄 Fetched teams page ${currentPage} of ${pageData.totalPages}, continuing to next page...`);
// 			await new Promise((resolve) => setTimeout(resolve, 500));
// 		}

// 		// prepare arrays to store the results of the update
// 		let teamsDeleted = 0;
// 		let teamsUpdated = 0;
// 		let teamsCreated = 0;

// 		// loop through all teams and update or create them in the database
// 		for (const team of allData) {
// 			// skip if name or id is missing
// 			if (!team.name || !team.uuid) continue;

// 			// build the payload object
// 			const payloadObject = {
// 				name: team.name,
// 				uuid: team.uuid,
// 				leagueUuid: team.leagueUuid,
// 				associationUuid: team.associationUuid,
// 				sportsclubUuid: team.sportsclubUuid,
// 			};

// 			// check if we have the team stored to determine if we need to update or create
// 			const cachedData = await payload.find({
// 				collection: "sams-teams",
// 				where: {
// 					uuid: {
// 						equals: team.uuid,
// 					},
// 				},
// 				select: { uuid: true }, // we only need the uuid for comparison
// 			});
// 			const cachedTeam = cachedData?.docs[0] as SamsTeam | undefined;

// 			// if we have the cached team, then update it, otherwise create it
// 			if (cachedTeam) {
// 				console.info(`🔄 Updating team: ${team.uuid} (${team.name})`);
// 				await payload.update({
// 					collection: "sams-teams",
// 					id: cachedTeam.id,
// 					data: payloadObject,
// 				});
// 				teamsUpdated++;
// 			} else {
// 				console.info(`🌱 Creating team: ${team.uuid} (${team.name})`);
// 				await payload.create({
// 					collection: "sams-teams",
// 					data: payloadObject,
// 				});
// 				teamsCreated++;
// 			}
// 		}

// 		const deletedTeams = await payload.delete({
// 			collection: "sams-teams",
// 			where: {
// 				updatedAt: {
// 					less_than: new Date(Date.now() - 1000 * 60 * 60), // delete teams that were not updated in the last 60 minutes
// 				},
// 			},
// 		});
// 		for (const team of deletedTeams.docs) {
// 			console.info(`🗑️ Deleted ${team.name} because they were no longer on SAMS`);
// 			teamsDeleted++;
// 		}

// 		return { created: teamsCreated, updated: teamsUpdated, deleted: teamsDeleted };
// 	} catch (error) {
// 		console.error("🚨 Error updating Sams Teams:", error);
// 	}
// }
// Cron funciton to update Sams Clubs in the payload database
export async function cronSamsClubsUpdate() {
	"use cache";
	cacheLife(NON_REALTIME_CACHE);
	try {
		// get our assiciation ID from Sams
		const association = await samsAssociation(SAMS.association.name);
		if (!association?.uuid) throw `🚨 Association UUID for ${SAMS.association.name} not found on SAMS.`;

		// Default parameters for the API calls
		const defaultParams = {
			query: {
				association: association?.uuid,
				page: 0,
				size: 100,
			},
			headers: {
				"X-API-Key": process.env.SAMS_API_KEY || "",
			},
		};

		// Define the type for the sports club data without the pagination
		type Sportsclub = {
			uuid?: string;
			name?: string;
			associationUuid?: string | null;
			logoImageLink?: string | null;
		};

		// Array to hold all fetched sports clubs
		const allData: Sportsclub[] = [];
		let currentPage = 0;
		let hasMorePages = true;

		// Continue fetching until no more pages
		while (hasMorePages) {
			const {
				data: pageData,
				error: pageError,
				response: pageResponse,
			} = await getAllSportsclubs({
				...defaultParams,
				query: { ...defaultParams.query, page: currentPage },
			});

			if (pageError) {
				throw new Error(`Warning: Error ${pageResponse.status} fetching clubs page ${currentPage}: ${pageError}`);
			}

			if (pageData.content) {
				const clubs = pageData.content.map((c) => {
					return {
						name: c.name,
						uuid: c.uuid,
						associationUuid: c.associationUuid,
						logoImageLink: c.logoImageLink,
					};
				});
				allData.push(...clubs);
				currentPage++;
			}

			if (pageData.last === true) hasMorePages = false;
		}

		// prepare arrays to store the results of the process
		let clubsDeleted = 0;
		let clubsUpdated = 0;
		let clubsCreated = 0;

		// loop through all clubs and update or create them in the database
		for (const club of allData) {
			// skip if name or id is missing
			if (!club.name || !club.uuid) continue;

			// build the payload object
			const payloadObject = {
				name: club.name,
				sportsclubUuid: club.uuid,
				logo: club.logoImageLink || null,
				associationUuid: club.associationUuid,
			};

			// check if we have the club stored to determine if we need to update or create
			const cachedData = await payload.find({
				collection: "sams-clubs",
				where: {
					sportsclubUuid: {
						equals: club.uuid,
					},
				},
				select: { sportsclubUuid: true }, // we only need the sportsclubUuid for comparison
			});
			const cachedClub = cachedData?.docs[0] as SamsClub | undefined;

			// if we have the cached club, then update it, otherwise create it
			if (cachedClub) {
				console.info(`🔄 Updating club: ${club.uuid} (${club.name})`);
				await payload.update({
					collection: "sams-clubs",
					id: cachedClub.id,
					data: payloadObject,
				});
				clubsUpdated++;
			} else {
				console.info(`🌱 Creating club: ${club.uuid} (${club.name})`);
				await payload.create({
					collection: "sams-clubs",
					data: payloadObject,
				});
				clubsCreated++;
			}
		}

		const deletedClubs = await payload.delete({
			collection: "sams-clubs",
			where: {
				updatedAt: {
					less_than: new Date(Date.now() - 1000 * 60 * 60), // delete clubs that were not updated in the last 60 minutes
				},
			},
		});
		for (const club of deletedClubs.docs) {
			console.info(`🗑️ Deleted ${club.name} because they were no longer on SAMS`);
			clubsDeleted++;
		}

		return { created: clubsCreated, updated: clubsUpdated, deleted: clubsDeleted };
	} catch (error) {
		console.error("🚨 Error fetching clubs data", error);
		return null;
	}
}
