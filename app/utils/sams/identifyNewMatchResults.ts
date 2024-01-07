import fs from "fs";
import path from "path";
import { cachedGetTeamIds } from "./cachedGetClubData";
import { matchesType } from "./typeMatches";
import { socialMatchesCache, socialMatchesEntry } from "../social/typeCache";

// prepare a list of matches that should be shared on social media
const SOCIAL_TIME_RANGE = 3, // time in days to look into the past for new results
	SOCIAL_CACHE_FILE = "matchResults.json", // file used to keep track of which matches have been shared on social already
	SOCIAL_CACHE_FOLDER = "data/social";

export function identifyNewMatchResults(matchData: string) {
	// - populate a list of matches somewhere "data/social/matchStatus.json" ??
	// - give that list an Object type. (matchUuid, date and status should be enough. the social sharing function should fetch the team names and craft a message itself)
	// - the status could be "new", "queued", "shared" maybe
	const matchDataJson: matchesType = JSON.parse(matchData);
	const matches = matchDataJson.matches.match;

	// exclude matches who do not have results, are too old and are not ours
	const todayMinusRange = new Date();
	todayMinusRange.setDate(todayMinusRange.getDate() - SOCIAL_TIME_RANGE);
	const teamIds = cachedGetTeamIds("id");
	const filteredMatches = matches.filter((match) => match.results && new Date(match.dateObject) >= todayMinusRange && (teamIds.includes(match.team[0].id) || teamIds.includes(match.team[1].id)));
	console.log(filteredMatches.length);
	// check if the social cache file exists
	if (!fs.existsSync(path.join(SOCIAL_CACHE_FOLDER, SOCIAL_CACHE_FILE))) {
		fs.mkdirSync(SOCIAL_CACHE_FOLDER, { recursive: true });
		fs.writeFileSync(path.join(SOCIAL_CACHE_FOLDER, SOCIAL_CACHE_FILE), '{"entries": []}');
		console.log("Social cache file was missing! Created a blank file.");
	}
	filteredMatches.forEach((match) => {
		const socialCacheFile = fs.readFileSync(path.join(SOCIAL_CACHE_FOLDER, SOCIAL_CACHE_FILE));
		const socialCacheString = socialCacheFile.toString();
		const socialCacheJson: socialMatchesCache = JSON.parse(socialCacheString);

		if (!socialCacheString.includes(match.uuid) && match.matchSeries.name && match.results) {
			// construct the object
			const newMatch: socialMatchesEntry = {
				uuid: match.uuid,
				date: match.dateObject,
				league: match.matchSeries.name,
				team: [match.team[0].name, match.team[1].name],
				winner: Number(match.results.winner),
				score: match.results.setPoints,
				mastodon: "new",
			};
			// append it to the existing data
			socialCacheJson.entries.push(newMatch);
			// write it back to the file
			fs.writeFileSync(path.join(SOCIAL_CACHE_FOLDER, SOCIAL_CACHE_FILE), JSON.stringify(socialCacheJson, null, 2));
		}
	});
}
