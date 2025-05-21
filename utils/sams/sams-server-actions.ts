"use server";
import { SAMS } from "@/project.config";
import dayjs from "dayjs";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { type Match, type Rankings, type Season, type SimpleSportsClub, type Sportsclub, sams } from "sams-rpc";

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

export async function samsSportsclub(sportsclubId: number | string): Promise<Sportsclub | undefined> {
	"use cache";
	cacheLife("days");

	try {
		// during development, we use a static example from the library
		if (process.env.NODE_ENV === "development") {
			const example = await fetch(
				"https://raw.githubusercontent.com/terijaki/sams-rpc/refs/heads/main/examples/sportsclub.json",
			);
			const exampleJson: Sportsclub = await example.json();
			return exampleJson;
		}

		console.log(`☝️ Fetching club by ID ${sportsclubId}`);
		const club = await sams.sportsclub({ sportsclubId });

		return club;
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

/* region OUR CLUB */
// returns our club's data
export async function samsClubData() {
	"use cache";
	cacheLife("hours");
	try {
		// get all clubs to find the club ID
		const allClubs = await sams.sportsclubList();
		const clubId = allClubs.find((club) => club.name.includes(SAMS_CLUB_NAME))?.id;
		if (!clubId) {
			throw new Error("Club ID not found");
		}
		// get the club data by using the club ID
		const club = await sams.sportsclub({ sportsclubId: clubId });
		return club;
	} catch (error) {
		console.error("🚨 Error fetching our club data:", error);
	}
}
// return the unique allSeasonMatchSeriesIds for the club
export async function samsClubAllSeasonMatchSeriesIds(leagueOnly = false) {
	try {
		// get the club data by using the club ID
		const club = await samsClubData();
		if (!club) throw new Error("Club data not found");

		// extract the unqiue match series from the teams
		const clubTeams = club?.teams?.team;
		const clubLeagueTeams = !leagueOnly // if leagueOnly is false, return all teams
			? clubTeams
			: clubTeams?.filter(
					(team) => team.status.toLowerCase() === "active" && team.matchSeries.type.toLowerCase() === "league",
				);
		const matchSeriesIds = clubLeagueTeams?.map((team) => team.matchSeries.allSeasonId);
		const unqiueMatchSeriesIds = Array.from(new Set(matchSeriesIds));
		return unqiueMatchSeriesIds;
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
		await Promise.all(
			unqiueMatchSeriesIds.map(async (allSeasonMatchSeriesId) => {
				const ranking = await samsRanking({ allSeasonMatchSeriesId });
				if (ranking?.ranking) rankings.push(ranking); // ranking?.ranking excludes empty rankings. e.g. for next-season-signups
			}),
		);

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
				});
				matches?.map((m) => clubMatchesMap.set(m.matchSeries.uuid, m)); // add the matches to the map
			}),
		);

		const clubMatches = Array.from(clubMatchesMap.values()); // convert the map to an array
		return clubMatches;
	} catch (error) {
		console.error("🚨 Error fetching club rankings:", error);
	}
}
/* endregion */

/* region WORKAROUNDS */
// return the club data by club name
export async function samsClubDataByClubName(name: string) {
	try {
		const allClubs = await sams.sportsclubList();

		const desiredClub = allClubs.find((club) => club.name?.toLowerCase().trim() === name.toLowerCase().trim());
		if (!desiredClub) throw "Club not found";

		const desiredClubData = await samsSportsclub(desiredClub.id);

		return desiredClubData;
	} catch (error) {
		console.log(`🚨 Error fetching club data by name (${name})`, error);
	}
}
/* endregion */
