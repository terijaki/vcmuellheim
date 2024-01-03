import fs from "fs";
import path from "path";

const SAMS_MATCHES_FOLDER = "data/sams/matches";

export function getMatches(teamIds: (string | number)[], filter?: "past" | "future"): matchesArray[] {
	// setup the empty array
	let matches: matchesArray[] = [];
	// go through each item in the teamIds array
	teamIds.forEach((teamId) => {
		const file = path.join(SAMS_MATCHES_FOLDER, teamId.toString()) + ".json";
		if (fs.existsSync(file)) {
			const matchesContent = fs.readFileSync(file);
			const matchesObject = JSON.parse(matchesContent.toString());
			const matchesArray = matchesObject.matches.match;
			// merge matches for this teamId with the matches Array
			matches = matches.concat(matchesArray);
		}
	});
	// sort matches by date
	const sortedMatches = matches.sort((a, b) => {
		// transform the sams date from "19.03.2024" to "2024-03-19"
		const aDate = a.date?.slice(6, 10) + "-" + a.date?.slice(3, 5) + "-" + a.date?.slice(0, 2);
		const bDate = b.date?.slice(6, 10) + "-" + b.date?.slice(3, 5) + "-" + b.date?.slice(0, 2);
		return new Date(aDate).getTime() - new Date(bDate).getTime();
	});
	let matchesUuids = new Set();
	let filtereduniqueMatches = sortedMatches.filter((match) => {
		if (matchesUuids.has(match.uuid)) {
			return false;
		}
		matchesUuids.add(match.uuid);
		return true;
	});
	let filteredMatches = filtereduniqueMatches;
	if (filter == "past") {
		filteredMatches = filtereduniqueMatches.filter((match) => match.results).reverse();
		// reverse sort order
	} else if (filter == "future") {
		filteredMatches = filtereduniqueMatches.filter((match) => !match.results);
	}

	return filteredMatches;
	// see type below for how the matches are structured
}

export type matchesArray = {
	id: string;
	uuid: string;
	number?: string;
	name: string;
	club?: { name?: string };
	date: string;
	time?: string;
	host?: { id?: string; uuid?: string; name?: string; club?: string };
	team?: [{ number?: string; id?: string; uuid?: string; name?: string; club?: { name?: string } }, { number?: string; id?: string; uuid?: string; name?: string; club?: { name?: string } }];
	matchSeries?: {
		id: string;
		uuid: string;
		name?: string;
		type?: string;
		updated?: string;
		resultsUpdated?: string;
		season?: { id: string; uuid?: string; name?: string };
	};
	location?: { id?: string; name?: string; street: string; postalCode: string; city: string };
	results?: { winner?: string; setPoints?: string; ballPoints?: string; sets?: { set?: [{ number?: string; points?: string; winner?: string }] } };
};
