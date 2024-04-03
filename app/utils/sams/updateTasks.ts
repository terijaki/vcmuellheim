// this a sequence of code to be executed in order to keep our data in sync with SAMS while not hammering their API unnecessarily
// run during deployment via: npx tsx --env-file=.env.local --env-file=.env app/utils/samsUpdateTasks.ts
import fs from "fs";
import path from "path";
import { env } from "process";
import { cachedGetTeamIds, cachedGetUniqueMatchSeriesIds } from "./cachedGetClubData";
import { writeToSummary } from "../github/actionSummary";
import getMatchSeries from "./getMatchSeries";
import getClubData from "./getClubData";
import getRankings from "./getRankings";
import getMatches from "./getMatches";
import getPlayers from "./getPlayers";
import getAllClubs from "./getAllClubs";
import { getClubId } from "./getClubLogo";
import { slugify } from "../slugify";
import verifyTeams from "./verifyTeams";

const SAMS_CLUB_ID = env.SAMS_CLUBID;
const CLUBS_CACHE_FOLDER = "data/sams/clubs";

// there is no rate limit on the getMatchSeries request ✌️
getMatchSeries()
	.then(() => {
		getClubData(Number(SAMS_CLUB_ID)).then(() => {
			// get our Match Series IDs so that we can use them to filter requests
			const ourMatchSeries = cachedGetUniqueMatchSeriesIds(cachedGetTeamIds("id"));
			// read the big Match Series file
			const matchSeriesJsonFile = fs.readFileSync("data/sams/matchSeries.json");
			const matchSeriesJson = JSON.parse(matchSeriesJsonFile.toString());
			// filter down to our ids only
			const matchSeriesJsonFiltered = matchSeriesJson.matchSeriesList.matchSeries.filter((series: { id: string | number }) => ourMatchSeries.includes(series.id.toString()));
			// identify which of our Match Series need to be updated
			matchSeriesJsonFiltered.map((series: { id: string | number; type: string; structureUpdated: string; resultsUpdated: string; name: string }) => {
				// RANKINGS
				const rankingsJsonFile = "data/sams/matchSeriesId/" + series.id + "/rankings.json";
				if (fs.existsSync(rankingsJsonFile)) {
					const rankingsJsonFileContent = fs.readFileSync(rankingsJsonFile);
					const rankingsJson = JSON.parse(rankingsJsonFileContent.toString());
					if (rankingsJson.rankings.matchSeries.resultsUpdated != series.resultsUpdated || rankingsJson.rankings.matchSeries.structureUpdated != series.structureUpdated) {
						let consoleNote = "🕵️ Rankings for " + series.name + " (" + series.id + ") are outdated. Fetching new rankings...";
						console.log(consoleNote);
						writeToSummary(consoleNote);
						getRankings(series.id);
					} else {
						let consoleNote = "✅ Rankings for " + series.name + " (" + series.id + ") are up to date.";
						console.log(consoleNote);
						writeToSummary(consoleNote);
					}
				} else {
					let consoleNote = "🕵️ Rankings for " + series.name + " (" + series.id + ") do not exist. Fetching new rankings...";
					console.log(consoleNote);
					writeToSummary(consoleNote);
					getRankings(series.id);
				}
				// MATCHES
				// need to check if the file already exists
				const matchesJsonFile = "data/sams/matchSeriesId/" + series.id + "/matches.json";
				if (fs.existsSync(matchesJsonFile)) {
					const matchesJsonFileContent = fs.readFileSync(matchesJsonFile);
					const matchesJson = JSON.parse(matchesJsonFileContent.toString());
					if (matchesJson.matches.match[0].matchSeries.resultsUpdated != series.resultsUpdated || matchesJson.matches.match[0].matchSeries.structureUpdated != series.structureUpdated) {
						let consoleNote = "🕵️ Matches for " + series.name + " (" + series.id + ") are outdated. Fetching new matches...";
						console.log(consoleNote);
						writeToSummary(consoleNote);
						getMatches(undefined, series.id);
					} else {
						let consoleNote = "✅ Matches for " + series.name + " (" + series.id + ") are up to date.";
						console.log(consoleNote);
						writeToSummary(consoleNote);
					}
				} else {
					let consoleNote = "🕵️ Matches for " + series.name + " (" + series.id + ") do not exist. Fetching new matches...";
					console.log(consoleNote);
					writeToSummary(consoleNote);
					getMatches(undefined, series.id);
				}
			});
			// PLAYERS
			// fetches and stores player data for each team
			cachedGetTeamIds("id", true).forEach((teamId) => getPlayers(teamId));
		});
	})
	.catch((error) => {
		console.log(error);
	})
	.finally(() => {
		return;
	});

// CLUBS
getAllClubs(); // gets all clubs, containing name and id (no details such as teams or logos)
if (!fs.existsSync("data/sams/matchSeriesId") || !fs.readdirSync("data/sams/matchSeriesId")) {
	console.log("🚨 Unable to process relevant clubs because not a single matchseries is present.");
} else {
	// find all rankings and combine them
	const rankings = fs.readdirSync("data/sams/matchSeriesId", { recursive: true, withFileTypes: true });
	const rankingsFiltered = rankings.filter((entry) => entry.name.includes("rankings.json"));
	// filter out duplicate clubs
	let clubs = new Set();
	rankingsFiltered.map((rankings) => {
		const fullPath = path.join(rankings.path, rankings.name);
		const rankingFile = fs.readFileSync(fullPath);
		const rankingContent = JSON.parse(rankingFile.toString()).rankings.ranking;
		rankingContent.map((team: { team: { club: { name: string } } }) => {
			let clubName = team.team.club.name.toString();
			if (!clubs.has(clubName)) {
				clubs.add(clubName);
			}
		});
	});
	// get a cache for each club
	clubs.forEach(async (club) => {
		if (club) {
			const clubSlug = slugify(club.toString());
			const cacheFile = path.join(CLUBS_CACHE_FOLDER, clubSlug + ".json");
			if (!fs.existsSync(cacheFile)) {
				console.log("cache does not exist for " + clubSlug);
				const clubId = await getClubId(club.toString());
				const clubData = await getClubData(Number(clubId));
				fs.mkdirSync(CLUBS_CACHE_FOLDER, { recursive: true });
				fs.writeFileSync(cacheFile, JSON.stringify(clubData.response));
			}
		}
	});
}

// TEAM'S SBVV-ID
verifyTeams();
