// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Tabellen
// Gibt die aktuelle Tabelle einer Liga oder eines Wettbewerbs aus.
// URL: https://<verbandsadresse>/xml/rankings.xhtml
// Beispiel: https://www.volleyball-bundesliga.de/xml/rankings.xhtml?apiKey=XXXXXXXXXXXXXXXXXXXXXX&matchSeriesId=12345
// benötiger Parameter:
// matchSeriesId - Id einer Spielrunde (Bsp.: matchSeriesId=12345)
// alternativ: allSeasonMatchSeriesId - saisonübergreifende Spielrunden-ID (Bsp.: allSeasonMatchSeriesId=012bfd2f-ad4a-40f5-8cef-a88e6a27a3aa)
import { SAMS } from "@/project.config";
import { env } from "process";
import { makeArrayUnique } from "../makeArrayUnique";

const SAMS_API = env.SAMS_API,
	SAMS_URL = SAMS.url;

/** Returns one or more Ranking when provided with a matchSeriesId
 * @param matchSeriesIds can be either a matchSeriesId or allSeasonMatchSeriesId */
export async function getRankings(matchSeriesIds: (string | number)[]): Promise<Rankings[] | false> {
	if (!matchSeriesIds || matchSeriesIds.length == 0) {
		console.log("🚨 NO MATCHSERIESID PROVIDED IN RANKINGS CONTEXT! 🚨");
		return false;
	}
	let output: Rankings[] = [];

	const uniqueMatchSeriesIds = makeArrayUnique(matchSeriesIds); // remove duplicate match series (in case they have not been sanitised when requested)

	for (const series of uniqueMatchSeriesIds) {
		const ranking = await getRanking(series);
		if (ranking) output.push(ranking);
	}
	if (output.length > 0) return output;

	return false;
}

/** Returns a single Ranking when provided with a matchSeriesId
 * @param matchSeriesId can be either a matchSeriesId or allSeasonMatchSeriesId */
export async function getRanking(matchSeriesId: string | number): Promise<Rankings | false> {
	if (!matchSeriesId) {
		console.log("🚨 NO MATCHSERIESID PROVIDED IN RANKING CONTEXT! 🚨");
		return false;
	} else if (!SAMS_API) {
		console.log("🚨 SAMS API KEY MISSING IN FETCH RANKING CONTEXT! 🚨");
		return false;
	}
	const apiURL = SAMS_URL + "/xml/rankings.xhtml?apiKey=" + SAMS_API + "&matchSeriesId=" + matchSeriesId;

	const samsRequest = await fetch(apiURL, { next: { revalidate: 600, tags: ["sams", "rankings"] } });

	// make the server request and check its status
	if (!samsRequest.status || samsRequest.status != 200) {
		console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR RANKING (" + matchSeriesId + ")! 🚨");
		return false;
	}

	// read the XML response
	const samsXMLResponseText = await samsRequest.text(); // this is the XML response
	if (!samsXMLResponseText) {
		console.log("🚨 RECEIVED EMPTY MESSAGE FOR RANKING (" + matchSeriesId + ")! 🚨");
		return false;
	} else if (samsXMLResponseText.includes("<error>")) {
		console.log("🚨 RECEIVED ERROR MESSAGE FOR RANKING (" + matchSeriesId + ")! 🚨");
		console.log(samsXMLResponseText);
		return false;
	}
	// turn the XML string into an Object
	let thisObject: false | Rankings = false;
	const parseString = require("xml2js").parseString;
	await parseString(samsXMLResponseText, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: RankingsXMLResponse) {
		if (!err) {
			// console.log("✅ Ranking data looks good for " + result.rankings.matchSeries.name + " (" + matchSeriesId + ")");
			thisObject = result.rankings;
			return result;
		} else {
			console.log("🚨 COULD NOT CONVERT RANKING (" + matchSeriesId + ") XML TO JSON! 🚨");
			console.log(err);
			return false;
		}
	});

	if (thisObject) return thisObject;
	console.log("🚨 SOMETHING WENT WRONT WHILE RETRIEVING RANKING (" + matchSeriesId + ")! 🚨");
	return false;
}

//#region -- Type Definitions for Rankings --
type RankingsXMLResponse = {
	rankings: Rankings;
};

export type Rankings = {
	matchSeries: MatchSeries;
	ranking: Ranking[];
};

export type MatchSeries = {
	id: string;
	uuid: string;
	allSeasonId: string;
	name: string;
	shortName: string;
	type: string;
	updated: Date;
	structureUpdated: Date;
	resultsUpdated: Date;
	season: Season;
	hierarchy: Hierarchy;
	fullHierarchy: FullHierarchy;
	association: Association;
};

export type Association = {
	name: string | null;
	shortName?: string | null;
};

export type FullHierarchy = {
	hierarchy: Hierarchy[];
};

export type Hierarchy = {
	id: string;
	name: string;
	shortName: string;
	hierarchyLevel: string;
	uuid?: string;
};

export type Season = {
	id: string;
	uuid: string;
	name: string;
};

export type Ranking = {
	team: Team;
	place: string;
	matchesPlayed: string;
	wins: string | null;
	losses: string;
	points: string;
	setPoints: string;
	setWinScore: string;
	setLoseScore: string;
	setPointDifference: string;
	setQuotient: string;
	ballPoints: string;
	ballWinScore: string;
	ballLoseScore: string;
	ballPointDifference: string;
	ballQuotient: string;
	resultTypes?: ResultTypes;
};

export type ResultTypes = {
	matchResult?: MatchResult[];
};

export type MatchResult = {
	result: string;
	count: string;
};

export type Team = {
	id: string;
	uuid: string;
	name: string;
	shortName: null | string;
	clubCode?: null | string;
	club: Association;
};
//#endregion
