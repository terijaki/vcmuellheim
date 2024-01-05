import fs from "fs";
import path from "path";
import { getUniqueMatchSeriesIds } from "./jsonClubData";
import convertDate from "./convertDate";

const SAMS_FOLDER = "data/sams";

export function getMatches(teamIds: (string | number)[], filter?: "past" | "future"): matchesArray[] {
	// setup the empty array
	let matches: matchesArray[] = [];

	// use the teamIds to fetch the relevant matchSeriesIds, then go through each series
	getUniqueMatchSeriesIds(teamIds).forEach((matchSeriesId) => {
		const file = path.join(SAMS_FOLDER, "matchSeriesId", matchSeriesId.toString()) + "/matches.json";
		if (fs.existsSync(file)) {
			const matchesContent = fs.readFileSync(file);
			const matchesObject = JSON.parse(matchesContent.toString());
			const matchesArray = matchesObject.matches.match;
			// merge matches for this matchSeries with the matches Array
			matches = matches.concat(matchesArray);
		}
	});

	// filter out matches that have nothing to do with the provided teamIds
	const ourMatches = matches.filter((match) => {
		if (match.team && match.team[0].id && match.team[1].id) {
			if (teamIds.includes(match.team[0].id) || teamIds.includes(match.team[1].id)) {
				return true;
			}
		}
		return false;
	});

	// sort matches by date
	const sortedMatches = ourMatches.sort((a, b) => {
		// transform the sams date from "19.03.2024" to "2024-03-19"
		const aDate = a.date?.slice(6, 10) + "-" + a.date?.slice(3, 5) + "-" + a.date?.slice(0, 2);
		const bDate = b.date?.slice(6, 10) + "-" + b.date?.slice(3, 5) + "-" + b.date?.slice(0, 2);
		return new Date(aDate).getTime() - new Date(bDate).getTime();
	});

	// filter our duplicate matches
	let matchesUuids = new Set();
	let filteredUniqueMatches = sortedMatches.filter((match) => {
		if (matchesUuids.has(match.uuid)) {
			return false;
		}
		matchesUuids.add(match.uuid);
		return true;
	});

	// add date Object and ISO so other areas of the app can use this more conviniently
	filteredUniqueMatches.map((match) => {
		match.dateObject = convertDate(match.date, match.time);
		match.dateIso = match.dateObject.toISOString();
	});

	// filter matches based on a provided filter
	let filteredMatches = filteredUniqueMatches;
	if (filter == "past") {
		filteredMatches = filteredUniqueMatches.filter((match) => match.results).reverse();
		// reverse sort order
	} else if (filter == "future") {
		filteredMatches = filteredUniqueMatches.filter((match) => !match.results);
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
	dateObject: Date; // custom property, generated when served
	dateIso: string; // custom property, generated when served
};
