// this a sequence of code to be executed in order to keep our data in sync with SAMS while not hammering their API unnecessarily
// run during deployment via: npx tsx --env-file=.env.local --env-file=.env app/utils/samsUpdateTasks.ts
import fs from "fs";
import { cachedGetTeamIds, cachedGetUniqueMatchSeriesIds } from "./cachedGetClubData";
import getMatchSeries from "./getMatchSeries";
import getClubData from "./getClubData";
import getRankings from "./getRankings";
import getMatches from "./getMatches";

const GITHUB_SUMMARY_FILE = "github_summary.md";

// there is no rate limit on the getMatchSeries request ✌️
getMatchSeries()
	.then(() => {
		getClubData().then(() => {
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
						let message = "🕵️ Rankings for " + series.name + " (" + series.id + ") are outdated. Fetching new rankings...";
						console.log(message);
						writeToSummary(message);
						getRankings(series.id);
					} else {
						let message = "✅ Rankings for " + series.name + " (" + series.id + ") are up to date.";
						console.log(message);
						writeToSummary(message);
					}
				} else {
					let message = "🕵️ Rankings for " + series.name + " (" + series.id + ") do not exist. Fetching new rankings...";
					console.log(message);
					writeToSummary(message);
					getRankings(series.id);
				}
				// MATCHES
				// need to check if the file already exists
				const matchesJsonFile = "data/sams/matchSeriesId/" + series.id + "/matches.json";
				if (fs.existsSync(matchesJsonFile)) {
					const matchesJsonFileContent = fs.readFileSync(matchesJsonFile);
					const matchesJson = JSON.parse(matchesJsonFileContent.toString());
					if (matchesJson.matches.match[0].matchSeries.resultsUpdated != series.resultsUpdated || matchesJson.matches.match[0].matchSeries.structureUpdated != series.structureUpdated) {
						let message = "🕵️ Matches for " + series.name + " (" + series.id + ") are outdated. Fetching new matches...";
						console.log(message);
						writeToSummary(message);
						getMatches(undefined, series.id);
					} else {
						let message = "✅ Matches for " + series.name + " (" + series.id + ") are up to date.";
						console.log(message);
						writeToSummary(message);
					}
				} else {
					let message = "🕵️ Matches for " + series.name + " (" + series.id + ") do not exist. Fetching new matches...";
					console.log(message);
					writeToSummary(message);
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

// this writes to a file that is being read during the github actions run to craft a summary of the job
export function writeToSummary(text: string) {
	if (!fs.existsSync(GITHUB_SUMMARY_FILE)) {
		fs.writeFileSync(GITHUB_SUMMARY_FILE, "");
	}
	fs.appendFileSync(GITHUB_SUMMARY_FILE, text + "\n");
}
