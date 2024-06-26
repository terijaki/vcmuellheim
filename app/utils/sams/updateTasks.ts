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
import getAllClubs, { clubData } from "./getAllClubs";
import { getClubId } from "./getClubLogo";
import { slugify } from "../slugify";
import verifyTeams from "./verifyTeams";
import { getSeasons } from "./getSeasons";

const SAMS_CLUB_NUMBER = env.NEXT_PUBLIC_SAMS_CLUB_NUMBER,
	SAMS_CLUB_NAME = env.NEXT_PUBLIC_SAMS_CLUB_NAME;
const CLUBS_CACHE_FOLDER = "data/sams/clubs";

// GET ALL CLUBS
// this is required to turn the user facing "Vereinsnummer" (internalSportsclubId) into the club id used for all other queries
// gets all clubs, containing name, id and association (no details such as the club's teams or logos)
getAllClubs()
	.then((response) => {
		if (!response) {
			let message = "🚨 Data for all clubs could not be retrieved!";
			console.log(message);
			writeToSummary(message);
			throw message;
		} else {
			const clubsObjects: clubData = JSON.parse(response);
			const filteredClub = clubsObjects.sportsclubs.sportsclub.filter((club) => club.name == SAMS_CLUB_NAME && club.internalSportsclubId == SAMS_CLUB_NUMBER);
			const samsClubId = Number(filteredClub[0].id),
				samsClubName = filteredClub[0].name,
				samsClubAssociation = filteredClub[0].association.name;
			if (!(samsClubId > 1)) {
				let message = "🚨 Club ID could not be found in all clubs data!";
				console.log(message);
				writeToSummary(message);
				throw message;
			} else {
				return { name: samsClubName, id: samsClubId, association: samsClubAssociation };
			}
		}
	})
	.then((club) => {
		console.log("✅ Continue with SAMS Update Tasks for " + club.name + " (" + club.id + "), associtated with " + club.association);
		// there is no rate limit on the getSeasons request ✌️
		getSeasons();
		// there is no rate limit on the getMatchSeries request ✌️
		getMatchSeries()
			.then(() => {
				getClubData(club.id).then(() => {
					// get our Match Series IDs so that we can use them to filter requests
					const ourMatchSeries = cachedGetUniqueMatchSeriesIds(cachedGetTeamIds("id", false));
					// read the big Match Series file
					const matchSeriesJsonFile = fs.readFileSync("data/sams/matchSeries.json");
					const matchSeriesJson = JSON.parse(matchSeriesJsonFile.toString());
					// filter down to our ids only
					const matchSeriesJsonFiltered = matchSeriesJson.matchSeriesList.matchSeries.filter((series: { id: string | number }) => ourMatchSeries.includes(series.id.toString()));
					// sets to consolidate summary messages if everything is up to date
					const matchesSummary = new Set<string>();
					const rankingsSummary = new Set<string>();
					// identify which of our Match Series need to be updated
					matchSeriesJsonFiltered.map((series: { id: string | number; type: string; structureUpdated: string; resultsUpdated: string; name: string }) => {
						// RANKINGS
						const rankingsJsonFile = "data/sams/matchSeriesId/" + series.id + "/rankings.json";
						if (fs.existsSync(rankingsJsonFile)) {
							const rankingsJsonFileContent = fs.readFileSync(rankingsJsonFile);
							const rankingsJson = JSON.parse(rankingsJsonFileContent.toString());
							if (rankingsJson.rankings.matchSeries.resultsUpdated != series.resultsUpdated || rankingsJson.rankings.matchSeries.structureUpdated != series.structureUpdated) {
								let consoleNote = "🕵️ Rankings for " + series.name + " (" + series.id + ") were outdated.";
								console.log(consoleNote);
								rankingsSummary.add(consoleNote);
								getRankings(series.id);
							} else {
								let consoleNote = "✅ Rankings for " + series.name + " (" + series.id + ") are up to date.";
								console.log(consoleNote);
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
								let consoleNote = "🕵️ Matches for " + series.name + " (" + series.id + ") were outdated.";
								console.log(consoleNote);
								matchesSummary.add(consoleNote);
								getMatches(undefined, series.id);
							} else {
								let consoleNote = "✅ Matches for " + series.name + " (" + series.id + ") are up to date.";
								console.log(consoleNote);
							}
						} else {
							let consoleNote = "🕵️ Matches for " + series.name + " (" + series.id + ") do not exist. Fetching new matches...";
							console.log(consoleNote);
							writeToSummary(consoleNote);
							getMatches(undefined, series.id);
						}
					});
					// github summary messages for RANKINGS and MATCHES
					if (rankingsSummary.size > 1) {
						rankingsSummary.forEach((entry) => {
							writeToSummary(entry);
						});
					} else {
						let consoleNote = "✅ Rankings are all up to date.";
						writeToSummary(consoleNote);
					}
					if (matchesSummary.size > 1) {
						matchesSummary.forEach((entry) => {
							writeToSummary(entry);
						});
					} else {
						let consoleNote = "✅ Matches are all up to date.";
						writeToSummary(consoleNote);
					}

					// PLAYERS
					// fetches and stores player data for each team
					getPlayers(cachedGetTeamIds("id", true));
				});
			})
			.catch((error) => {
				console.log(error);
			})
			.finally(() => {
				return;
			});

		// CLUBS
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
					if (team.team.club && team.team.club.name) {
						let clubName = team.team.club.name.toString();
						if (!clubs.has(clubName)) {
							clubs.add(clubName);
						}
					}
				});
			});
			// get a cache for each club
			clubs.forEach(async (club) => {
				if (club) {
					const clubSlug = slugify(club.toString(), true);
					const cacheFile = path.join(CLUBS_CACHE_FOLDER, clubSlug + ".json");
					if (!fs.existsSync(cacheFile)) {
						console.log("🕵️ Club cache does not exist for " + club);
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

		// END OF TASKS
	})
	.catch((error) => {
		let message = error;
		console.log(message);
		writeToSummary(message);
		throw message;
	});
