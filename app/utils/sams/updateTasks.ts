// this a sequence of code to be executed in order to keep our data in sync with SAMS while not hammering their API unnecessarily
// run during deployment via: npx tsx --env-file=.env.local --env-file=.env app/utils/samsUpdateTasks.ts
import fs from "fs";
import { env } from "process";
import { cachedGetTeamIds, cachedGetUniqueMatchSeriesIds } from "./cachedGetClubData";
import getMatchSeries from "./getMatchSeries";
import getClubData from "./getClubData";
import getRankings from "./getRankings";
import getMatches from "./getMatches";
import { writeToSummary } from "../github/actionSummary";

const SAMS_CLUB_ID = env.SAMS_CLUBID;

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
		});
	})
	.catch((error) => {
		console.log(error);
	})
	.finally(() => {
		return;
	});
