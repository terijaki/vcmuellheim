// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Saisonübersicht
// Zeigt eine Liste aller verfügbaren Saisons an. Die ID der Saison kann in der Spielrundenübersicht verwendet werden, um Zugriff auf historische Daten zu erhalten.
import { env } from "process";
import { SAMS } from "@/project.config";

const SAMS_API = env.SAMS_API,
	SAMS_URL = SAMS.url;

/** Retrieves the Seasons.
 * Usually includes all past seasons and the upcoming season towards the end of the current season. */
export async function getSeasons(amount?: number, reverse = false): Promise<Season[] | false> {
	if (!SAMS_API) {
		console.log("🚨 SAMS API KEY MISSING IN FETCH SEASONS CONTEXT");
		return false;
	}
	const apiURL = SAMS_URL + "/xml/seasons.xhtml?apiKey=" + SAMS_API;

	const samsRequest = await fetch(apiURL, { next: { revalidate: 43200, tags: ["sams", "seasons"] } });

	// make the server request and check its status
	if (!samsRequest.status || samsRequest.status != 200) {
		console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR SEASONS! 🚨");
		return false;
	}

	// read the XML response
	const samsXMLResponseText = await samsRequest.text(); // this is the XML response
	if (!samsXMLResponseText) {
		console.log("🚨 RECEIVED EMPTY MESSAGE FOR SEASONS! 🚨");
		return false;
	} else if (samsXMLResponseText.includes("<error>")) {
		console.log("🚨 RECEIVED ERROR MESSAGE FOR SEASONS! 🚨");
		console.log(samsXMLResponseText);
		return false;
	}
	// turn the XML string into an Object
	let seasonsArray: false | Season[] = [];
	const parseString = require("xml2js").parseString;
	await parseString(samsXMLResponseText, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: SeasonsXMLResponse) {
		if (!err) {
			// console.log("✅ Seasons data looks good");
			seasonsArray = result.seasons.season;
			// return result;
		} else {
			console.log("🚨 COULD NOT CONVERT SEASONS XML TO JSON! 🚨");
			console.log(err);
			return false;
		}
	});
	if (seasonsArray.length == 0) return false;

	let seasonObjectWithDates = seasonsArray;
	seasonObjectWithDates.map((entry: any) => {
		entry.id = entry.id;
		entry.name = entry.name;
		entry.begin = new Date(entry.begin);
		entry.end = new Date(entry.end);
	});

	// sort it by date
	let seasonsSorted = seasonObjectWithDates;
	seasonsSorted.sort((a, b) => {
		return new Date(b.begin).getTime() - new Date(a.begin).getTime();
	});
	if (reverse) {
		// reverse the order
		seasonsSorted.reverse();
	}
	// trim it by the amount specified
	let seasonsTrimmed = seasonsSorted.slice(0, amount);

	if (seasonsTrimmed) return seasonsTrimmed;

	console.log("🚨 SOMETHING WENT WRONT WHILE RETRIEVING SEASONS! 🚨");
	return false;
}

type SeasonsXMLResponse = {
	seasons: { season: Season[] };
};

export type Season = {
	id: number;
	name: string;
	begin: string | Date;
	end: string | Date;
};
