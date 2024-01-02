// this a sequence of code to be executed in order to keep our data in sync with SAMS while not hammering their API unnecessarily
import fs from "fs";
import { getTeamIds, getUniqueMatchSeriesIds } from "@/app/utils/samsJsonClubData";
import getRankings from "@/app/utils/samsGetRankings";
import getMatchSeries from "@/app/utils/samsGetMatchSeries";
import getOurMatches from "@/app/utils/samsGetOurMatches";
import getClubData from "@/app/utils/samsGetClubData";
import getOurRankings from "@/app/utils/samsGetOurRankings";
import getMatches from "./samsGetMatches";

// there is no rate limit in this request type! ✌️
getMatchSeries().then(() => {
	// getClubData(); // probably not needed at all :D
	// getOurMatches(); // probably not needed at all :D
	// getOurRankings(); // probably not needed at all :D

	// get our Match Series IDs so that we can use them to filter requests
	const ourMatchSeries = getUniqueMatchSeriesIds(getTeamIds("id"));
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
				console.log("📋 Rankings for " + series.name + "(" + series.id + ") are outdated. Fetching new rankings...");
				getRankings(series.id);
			} else {
				console.log("✅ Rankings for " + series.name + "(" + series.id + ") are up to date.");
			}
		} else {
			console.log("📋 Rankings for " + series.name + "(" + series.id + ") do not exist. Fetching new rankings...");
			getRankings(series.id);
		}
		// MATCHES
		// need to check if the file already exists
		const matchesJsonFile = "data/sams/matchSeriesId/" + series.id + "/matches.json";
		if (fs.existsSync(matchesJsonFile)) {
			const matchesJsonFileContent = fs.readFileSync(matchesJsonFile);
			const matchesJson = JSON.parse(matchesJsonFileContent.toString());
			if (matchesJson.matches.match[0].matchSeries.resultsUpdated != series.resultsUpdated || matchesJson.matches.match[0].matchSeries.structureUpdated != series.structureUpdated) {
				console.log("📋 Matches for " + series.name + "(" + series.id + ") are outdated. Fetching new matches...");
				getMatches(undefined, series.id);
			} else {
				console.log("✅ Matches for " + series.name + "(" + series.id + ") are up to date.");
			}
		} else {
			console.log("📋 Matches for " + series.name + "(" + series.id + ") do not exist. Fetching new matches...");
			getMatches(undefined, series.id);
		}
	});
});
