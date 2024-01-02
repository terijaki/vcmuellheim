import fs from "fs";
import { getTeamIds, getUniqueMatchSeriesIds } from "@/app/utils/samsJsonClubData";
import getRankings from "@/app/utils/samsGetRankings";
import getMatchSeries from "@/app/utils/samsGetMatchSeries";
import getOurMatches from "@/app/utils/samsGetOurMatches";
import getClubData from "@/app/utils/samsGetClubData";
import getOurRankings from "@/app/utils/samsGetOurRankings";

// this a sequence of code to be executed in order to keep our data in sync with SAMS while not hammering their API unnecessarily
console.log(fs.readdirSync("."));
// there is no rate limit in this request type! ✌️
if (getMatchSeries()) {
	// getClubData();
	// getOurMatches();
	// getOurRankings();

	// get our Match Series IDs so that we can use them to filter requests
	const ourMatchSeries = getUniqueMatchSeriesIds(getTeamIds("id"));
	// read the big Match Series file
	const matchSeriesJsonFile = fs.readFileSync("data/sams/MatchSeries.json");
	const matchSeriesJson = JSON.parse(matchSeriesJsonFile.toString());
	// filter down to our ids only
	const matchSeriesJsonFiltered = matchSeriesJson.matchSeriesList.matchSeries.filter((series: { id: string | number }) => ourMatchSeries.includes(series.id));
	// identify which of our Match Series need to be updated
	matchSeriesJsonFiltered.map((series: { id: string | number; type: string; structureUpdated: string; resultsUpdated: string; name: string }) => {
		// RANKINGS
		const rankingsJsonFile = fs.readFileSync("data/sams/matchSeriesId/" + series.id + "/rankings.json");
		const rankingsJson = JSON.parse(rankingsJsonFile.toString());
		if (rankingsJson.rankings.matchSeries.resultsUpdated != series.resultsUpdated || rankingsJson.rankings.matchSeries.structureUpdated != series.structureUpdated) {
			console.log("📋 Rankings for " + series.name + " are outdated. Fetching new rankings...");
			getRankings(series.id);
		} else {
			console.log("✅ Rankings for " + series.name + " are up to date.");
		}
		// MATCHES
		const matchesJsonFile = fs.readFileSync("data/sams/matchSeriesId/" + series.id + "/matches.json");
		const matchesJson = JSON.parse(matchesJsonFile.toString());
		if (matchesJson.matches.match[0].matchSeries.resultsUpdated != series.resultsUpdated || matchesJson.matches.match[0].matchSeries.structureUpdated != series.structureUpdated) {
			console.log("📋 Matches for " + series.name + " are outdated. Fetching new matches...");
			getRankings(series.id);
		} else {
			console.log("✅ Matches for " + series.name + " are up to date.");
		}
	});
}
