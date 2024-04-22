import fs from "fs";
import { JSON_FILE_TARGET as CACHE_FILE } from "@/app/utils/sams/getSeasons";

export type seasonOriginData = { seasons: { season: [{ id: string; name: string; begin: string; end: string }] } };
type seasonObject = { id: string; name: string; begin: Date; end: Date };

export default function getCachedSeasons(amount: number, reverse = false): seasonObject[] {
	// read the cache file
	const seasonFile = fs.readFileSync(CACHE_FILE);
	const seasonObject = JSON.parse(seasonFile.toString());

	let seasonObjectWithDates = seasonObject.seasons.season;
	seasonObjectWithDates.map((entry: { id: string; name: string; begin: string | Date; end: string | Date }) => {
		entry.id = entry.id;
		entry.name = entry.name;
		entry.begin = new Date(entry.begin);
		entry.end = new Date(entry.end);
	});

	// sort it by date
	let seasonsSorted = seasonObjectWithDates;
	seasonsSorted.sort((a: { begin: Date }, b: { begin: Date }) => {
		return b.begin.getTime() - a.begin.getTime();
	});
	if (reverse) {
		// reverse the order
		seasonsSorted.reverse();
	}
	// trim it by the amount specified
	let seasonsTrimmed = seasonsSorted.slice(0, amount);

	return seasonsTrimmed;
}
