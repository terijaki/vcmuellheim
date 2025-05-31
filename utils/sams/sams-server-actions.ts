"use server";
import { payload } from "@/data/payload-client";
import type { SamsClub } from "@/data/payload-types";
import { SAMS } from "@/project.config";
import dayjs from "dayjs";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { type Match, type Rankings, type Season, type SimpleSportsClub, sams } from "sams-rpc";

// API KEY and SERVER URL should be set via env variables
const SAMS_CLUB_NAME = SAMS.name; // the exact name of the club in SAMS

// base functions
export async function samsSportsclubs(): Promise<SimpleSportsClub[] | undefined> {
	"use cache";
	cacheLife("weeks");
	try {
		// during development, we use a static example from the library
		if (process.env.NODE_ENV === "development") {
			const example = await fetch(
				"https://raw.githubusercontent.com/terijaki/sams-rpc/refs/heads/main/examples/sportsclubList.json",
			);
			const exampleJson: SimpleSportsClub[] = await example.json();
			return exampleJson;
		}

		console.log("☝️ Fetching ALL clubs");
		const allClubs = await sams.sportsclubList();

		return allClubs;
	} catch (error) {
		console.error("🚨 Error fetching clubs:", error);
	}
}

export async function samsSportsclub(sportsclubId: number | string): Promise<SamsClub | undefined> {
	"use cache";
	cacheLife("days");

	try {
		// check if we have fresh data in our database
		const cachedClubs = await payload.find({
			collection: "sams-clubs",
			where: {
				sportsclubId: { equals: sportsclubId },
			},
		});
		const cachedClub = cachedClubs?.docs[0] as SamsClub | undefined;
		// get the club data by using the club ID
		const club = await sams.sportsclub({ sportsclubId });
		if (!club) throw new Error("Club data not found");

		// build clubData object
		const clubData = {
			name: club.name,
			sportsclubId: club.id,
			lsbNumber: club.lsbNumber || null,
			internalSportsclubId: club.internalSportsclubId || null,
			logo: club.logo?.url,
			homepage: club.matchOperationCompany.homepage,
		};

		// update or create the club data in our database
		if (cachedClub?.id) {
			const updatedClub = await payload.update({
				collection: "sams-clubs",
				id: cachedClub.id,
				data: clubData,
			});
			return updatedClub;
		}
		const storeClub = await payload.create({
			collection: "sams-clubs",
			data: clubData,
		});
		return storeClub;
	} catch (error) {
		console.error("🚨 Error fetching club:", error);
	}
}

export async function samsRanking(props: Parameters<typeof sams.rankings>[0]): Promise<Rankings | undefined> {
	"use cache";
	cacheLife("minutes");

	try {
		// during development, we use a static example from the library
		if (process.env.NODE_ENV === "development") {
			const example = await fetch(
				"https://raw.githubusercontent.com/terijaki/sams-rpc/refs/heads/main/examples/rankings.json",
			);
			const exampleJson: Rankings = await example.json();
			return exampleJson;
		}

		const rankings = await sams.rankings(props);

		return rankings;
	} catch (error) {
		console.error(`🚨 Error fetching rankings: ${props.allSeasonMatchSeriesId} ${props.matchSeriesId}`, error);
	}
}

export async function samsSeasons(): Promise<Season[] | undefined> {
	"use cache";
	cacheLife("max");

	try {
		// during development, we use a static example from the library
		if (process.env.NODE_ENV === "development") {
			const example = await fetch(
				"https://raw.githubusercontent.com/terijaki/sams-rpc/refs/heads/main/examples/seasons.json",
			);
			const exampleJson: Season[] = await example.json();
			return exampleJson;
		}
		const seasons = await sams.seasons();

		return seasons;
	} catch (error) {
		console.error("🚨 Error fetching seasons", error);
	}
}

export async function samsMatches(props: Parameters<typeof sams.matches>[0]): Promise<Match[] | undefined> {
	"use cache";
	cacheLife("minutes");

	try {
		// during development, we use a static example from the library
		if (process.env.NODE_ENV === "development") {
			const example = await fetch(
				"https://raw.githubusercontent.com/terijaki/sams-rpc/refs/heads/main/examples/matches.json",
			);
			const exampleJson: Match[] = await example.json();
			return exampleJson;
		}
		const matches = await sams.matches(props);

		return matches;
	} catch (error) {
		console.error("🚨 Error fetching matches", error);
	}
}

// return the club data by club name
export async function samsClubDataByClubName(clubName: string, maxAge = 90): Promise<SamsClub | undefined> {
	"use cache";
	cacheLife("hours");
	try {
		// check if we have fresh data in our database
		const cachedClubsByName = await payload.find({
			collection: "sams-clubs",
			where: {
				name: { equals: clubName },
			},
		});
		const cachedClubByName = cachedClubsByName?.docs[0] as SamsClub | undefined;
		// if we have a cached club, return it
		if (cachedClubByName?.updatedAt && dayjs(cachedClubByName.updatedAt).isAfter(dayjs().subtract(maxAge, "day")))
			return cachedClubByName;

		// otherwise get fresh data, store it, and return it
		const allClubs = await samsSportsclubs();

		const clubId = allClubs?.find((club) => club.name.includes(clubName))?.id;
		if (!clubId) throw new Error("Club ID not found");

		const cachedClub = await samsSportsclub(clubId);
		return cachedClub;
	} catch (error) {
		console.error("🚨 Error fetching our club data:", error);
	}
}

/* region OUR CLUB */
// returns our club's data
export async function samsClubData(maxAge = 7): Promise<SamsClub | undefined> {
	return await samsClubDataByClubName(SAMS_CLUB_NAME, maxAge);
}
// return the unique allSeasonMatchSeriesIds for the club
export async function samsClubAllSeasonMatchSeriesIds(leagueOnly = false): Promise<string[] | undefined> {
	try {
		// get sams teams from the database
		const teamsCollection = await payload.find({
			collection: "sams-teams",
		});
		const teams = teamsCollection.docs || [];

		const unqiueMatchSeriesIds = new Set<string>(); // to store unique match series IDs
		// loop through the teams to get the allSeasonIds. respecting the leagueOnly filter
		teams.map((team) => {
			if (team.matchSeries_AllSeasonId && (!leagueOnly || team.matchSeries_Type?.toLowerCase() === "league"))
				unqiueMatchSeriesIds.add(team.matchSeries_AllSeasonId);
		});

		const data: string[] = Array.from(unqiueMatchSeriesIds);
		return data;
	} catch (error) {
		console.error("🚨 Error fetching club match series IDs:", error);
	}
}
// returns only the unique rankings for the club
export async function samsClubRankings() {
	"use cache";
	cacheLife("minutes");
	try {
		const unqiueMatchSeriesIds = await samsClubAllSeasonMatchSeriesIds(true);
		if (!unqiueMatchSeriesIds) throw "No match series IDs found";
		// collect rankings for all match series
		const rankings: Rankings[] = [];
		for (const allSeasonMatchSeriesId of unqiueMatchSeriesIds) {
			const ranking = await samsRanking({ allSeasonMatchSeriesId });
			if (ranking?.ranking) rankings.push(ranking); // ranking?.ranking excludes empty rankings. e.g. for next-season-signups
		}

		// sort rankings by hierarchyLevel
		rankings.sort((a, b) => {
			const hierarchyLevelA = a.matchSeries.hierarchy?.hierarchyLevel || 999;
			const hierarchyLevelB = b.matchSeries.hierarchy?.hierarchyLevel || 999;
			return hierarchyLevelA - hierarchyLevelB;
		});

		return rankings;
	} catch (error) {
		console.error("🚨 Error fetching club rankings:", error);
	}
}
// returns the clubs matches
export async function samsClubMatches({
	future,
	past,
	limit,
	before,
	after,
}: { future?: boolean; past?: boolean; limit?: number; before?: Date; after?: Date }) {
	"use cache";
	cacheLife("minutes");
	try {
		const unqiueMatchSeriesIds = await samsClubAllSeasonMatchSeriesIds(false);
		if (!unqiueMatchSeriesIds) throw "No match series IDs found";

		// collect matches for all match series
		const clubMatchesMap = new Map<string, Match>();
		await Promise.all(
			unqiueMatchSeriesIds.map(async (allSeasonMatchSeriesId) => {
				const matches = await samsMatches({
					allSeasonMatchSeriesId,
					future,
					past,
					limit,
					after: after ? dayjs(after).format("DD.MM.YYYY") : undefined,
					before: before ? dayjs(before).format("DD.MM.YYYY") : undefined,
					// teamId:undefined, // team filtering would be here but we don't want a single team filtered. otherwise there would be conflict when two teams play in the same season
				});
				matches?.map((m) => {
					if (m.team.some((t) => t.club === SAMS_CLUB_NAME)) clubMatchesMap.set(m.matchSeries.uuid, m);
				}); // add the matches to the map
			}),
		);

		const clubMatches = Array.from(clubMatchesMap.values()); // convert the map to an array
		// sort the matches by date
		clubMatches.sort((a, b) => {
			const dateA = dayjs(a.date);
			const dateB = dayjs(b.date);
			if (dateA.isSame(dateB)) {
				return (a.number || 0) - (b.number || 0);
			}
			// Sort ascending for future matches, descending for past matches
			if (future && !past) {
				return dateA.isBefore(dateB) ? -1 : dateA.isAfter(dateB) ? 1 : 0;
			}
			if (past && !future) {
				return dateA.isAfter(dateB) ? -1 : dateA.isBefore(dateB) ? 1 : 0;
			}
			// Default to ascending when both or neither are specified
			return dateA.isBefore(dateB) ? -1 : dateA.isAfter(dateB) ? 1 : 0;
		});
		return clubMatches;
	} catch (error) {
		console.error("🚨 Error fetching club rankings:", error);
	}
}
/* endregion */

// Cron funciton to update Sams Teams in the payload database
export async function samsTeamsUpdate() {
	try {
		// get the club id from sams/payload
		const clubData = await samsClubData();
		if (!clubData?.sportsclubId) throw "🚨 No sportsclubId found in clubData";
		// get the club data from sams
		const freshClubData = await sams.sportsclub({ sportsclubId: clubData.sportsclubId });
		if (!freshClubData) throw new Error("🚨 Club data could not be retrieved");
		const freshTeamsData = freshClubData.teams?.team || [];
		// filter out virtual teams which occur end of season in prep for the next seasons
		const validFreshData = freshTeamsData.filter(
			(team) =>
				!team.matchSeries.hierarchy.name.includes("Rueckmeldungen") && team.matchSeries.type.toLowerCase() === "league",
		);
		// deconstruct the teams to match the SamsTeams collection structure
		const freshTeams = validFreshData.map((team) => {
			return {
				name: team.name,
				uuid: team.uuid,
				seasonTeamId: team.seasonTeamId,
				season: team.matchSeries.season.name,
				matchSeries_Name: team.matchSeries.name,
				matchSeries_Id: team.matchSeries.id,
				matchSeries_Uuid: team.matchSeries.uuid,
				matchSeries_AllSeasonId: team.matchSeries.allSeasonId,
				matchSeries_Type: team.matchSeries.type,
			};
		});

		// read the existing data in the sams-teams collection to determine which teams to update, delete, or create
		const storedData = await payload.find({
			collection: "sams-teams",
			limit: 1000, // just to make sure we get all teams
			select: { uuid: true }, // we only need the id and uuid for comparison
		});
		const storedTeams = storedData.docs || [];

		// prepare arrays to store the results of the update
		const teamsDeleted = [];
		const teamsUpdated = [];
		const teamsToCreate = [];

		// handle update and deletion of existing teams
		for (const storedTeam of storedTeams) {
			const freshTeam = freshTeams.find((t) => t.uuid === storedTeam.uuid);
			if (freshTeam) {
				// update the team if it exists
				await payload.update({
					collection: "sams-teams",
					where: { id: { equals: storedTeam.id } },
					data: freshTeam,
				});
				teamsUpdated.push(storedTeam.id);
			} else {
				// delete the team if it does not exist in the fresh data
				await payload.delete({
					collection: "sams-teams",
					id: storedTeam.id,
				});
				teamsDeleted.push(storedTeam.id);
			}
		}

		// handle creation of new teams
		for (const freshTeam of freshTeams) {
			const isNewTeam = !storedTeams.some((t) => t.uuid === freshTeam.uuid);
			if (isNewTeam) {
				await payload.create({
					collection: "sams-teams",
					data: freshTeam,
				});
				teamsToCreate.push(freshTeam.uuid);
			}
		}

		return { created: teamsToCreate.length, updated: teamsUpdated.length, deleted: teamsDeleted.length };
	} catch (error) {
		console.error("🚨 Error updating Sams Teams:", error);
	}
}
