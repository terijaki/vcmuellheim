"use server";
// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Vereine
// Gibt eine Übersicht aller Vereine mit wichtigen Informationen aus.
// URL: https://<verbandsadresse>/xml/sportsclubList.xhtml
// Beispiel: https://www.volleyball-bundesliga.de/xml/sportsclubList.xhtml?apiKey=XXXXXXXXXXXXXXXXXXXXXX
// benötiger Parameter:
// keine
//
// Verein (detailliert)
// Gibt detaillierte Informationen zu einem bestimmten Verein aus.
// URL: https://<verbandsadresse>/xml/sportsclub.xhtml
// Beispiel: https://www.volleyball-bundesliga.de/xml/sportsclub.xhtml?apiKey=XXXXXXXXXXXXXXXXXXXXXX&sportsclubId=12345
// benötiger Parameter:
// sportsclubId - Id eines vorhandenen Vereins (Bsp.: sportsclubId=12345)
import { env } from "process";
import { SAMS } from "@/project.config";

const SAMS_API = env.SAMS_API,
	SAMS_URL = SAMS.url;

//#region -- Type Definitions for Club(s) --
export type ClubSimple = {
	id: string;
	name: string;
	lsbNumber: string;
	internalSportsclubId: string;
	association?: {
		id: string;
		name: string;
	};
};
export type Club = {
	id?: number;
	name?: string;
	logo?: SportsclubLogo;
	lsbNumber?: number;
	internalSportsclubId?: number;
	association?: SportsclubAssociation;
	matchOperationCompany?: MatchOperationCompany;
	teams?: Teams;
	locations?: Locations;
};
export type SportsclubAssociation = {
	id?: number;
	name?: string;
};
export type Locations = {
	main?: Main;
};
export type Main = {
	id?: number;
	name?: string;
	address?: MainAddress;
	homepage?: string;
};
export type MainAddress = {
	postbox?: string;
	street?: string;
	extraField?: string;
	postcode?: number;
	city?: string;
	region?: string;
	country?: string;
};
export type SportsclubLogo = {
	url?: string;
	filename?: string;
	createDate?: Date;
};
export type MatchOperationCompany = {
	id?: string;
	name?: string;
	address?: MatchOperationCompanyAddress;
	homepage?: string;
};
export type MatchOperationCompanyAddress = {
	postbox?: string;
	street?: string;
	extraField?: string;
	postcode?: string;
	city?: string;
	region?: string;
	country?: string;
};
export type Teams = {
	team?: Team[];
};
export type Team = {
	id?: number;
	uuid?: string;
	seasonTeamId?: number;
	placeCipher?: number;
	name?: string;
	shortName?: string;
	clubCode?: string;
	status?: string;
	www?: string;
	logo?: ClubLogo;
	club?: TeamsClub;
	matchSeries?: MatchSeries;
};
export type TeamsClub = {
	name?: string;
	id?: number;
	shortName?: string;
	logo?: ClubLogo;
	www?: string;
	wwwDepartment?: string;
};
export type ClubLogo = {
	url?: string;
};
export type MatchSeries = {
	id?: number;
	uuid?: string;
	allSeasonId?: string;
	name?: string;
	shortName?: string;
	type?: string;
	updated?: Date;
	structureUpdated?: Date;
	resultsUpdated?: Date;
	season?: Season;
	hierarchy?: Hierarchy;
	fullHierarchy?: FullHierarchy;
	association?: MatchSeriesAssociation;
};
export type MatchSeriesAssociation = {
	name?: string;
	shortName?: string;
};
export type FullHierarchy = {
	hierarchy?: Hierarchy[];
};
export type Hierarchy = {
	id?: number;
	name?: string;
	shortName?: string;
	hierarchyLevel?: number;
	uuid?: string;
};
export type Season = {
	id?: number;
	uuid?: string;
	name?: string;
};
//#endregion

/** Returns a array of basic club data for each club. No input required. */
export async function getAllClubs(): Promise<ClubSimple[] | false> {
	//#region caching since the response is likely to be larger than 2MB
	const cacheFile = Bun.file(".temp/allClubs.json", { type: "application/json" });
	if (await cacheFile.exists()) {
		const cacheAge = (new Date().getTime() - cacheFile.lastModified) / (1000 * 60 * 60 * 24); // in days
		// const cacheAge = (new Date().getTime() - cacheFile.lastModified) / (1000 * 60); // in minutes
		if (cacheAge < 1) {
			const cacheData = await cacheFile.json();
			return cacheData;
		}
	}
	//#endregion caching

	if (!SAMS_API) {
		console.log("🚨 SAMS API KEY MISSING IN FETCH ALL CLUBS CONTEXT");
		return false;
	}
	const apiURL = SAMS_URL + "/xml/sportsclubList.xhtml?apiKey=" + SAMS_API;
	const samsRequest = await fetch(apiURL, { cache: "no-cache", method: "POST" });
	// make the server request and check its status
	if (!samsRequest.status || samsRequest.status != 200) {
		console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR ALL CLUBS! 🚨 ERROR: " + samsRequest.status);
		return false;
	}
	// read the XML response
	const samsXMLResponseText = await samsRequest.text(); // this is the XML response
	if (!samsXMLResponseText) {
		console.log("🚨 EMPTY RESPONSE RECEIVED FOR ALL CLUBS! 🚨");
		return false;
	} else if (samsXMLResponseText.includes("<error>")) {
		console.log("🚨 RECEIVED ERROR MESSAGE FOR ALL CLUBS! 🚨");
		console.log(samsXMLResponseText);
		return false;
	}
	// turn the XML string into an Object
	let allClubs: false | ClubSimple[] = false;
	const parseString = require("xml2js").parseString;
	await parseString(samsXMLResponseText, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
		if (!err) {
			// console.log("✅ Data for all clubs converted from XML to JSON.");
			// console.log(result);
			allClubs = result.sportsclubs.sportsclub;
			if (allClubs) {
				Bun.write(cacheFile, JSON.stringify(allClubs));
				return allClubs;
			}
		} else {
			console.log("🚨 COULD NOT CONVERT CLUBS XML TO JSON! 🚨");
			console.log(err);
			return false;
		}
	});
	if (allClubs) return allClubs;
	console.log("🚨 SOMETHING WENT WRONT WHILE RETRIEVING ALL CLUBS! 🚨");
	return false;
}

export async function getClubData(clubId: number): Promise<Club | false> {
	if (!SAMS_API) {
		console.log("🚨 SAMS API KEY MISSING IN FETCH CLUB DATA CONTEXT");
		return false;
	}

	const apiURL = SAMS_URL + "/xml/sportsclub.xhtml?apiKey=" + SAMS_API + "&sportsclubId=" + clubId;

	const samsRequest = await fetch(apiURL, { next: { revalidate: 3600 * 24, tags: ["sams", "club", clubId.toString()] } });

	// make the server request and check its status
	if (samsRequest.status != 200) {
		console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR CLUB " + clubId + "! 🚨");
		return false;
	}
	// read the XML response
	const samsXMLResponseText = await samsRequest.text(); // this is the XML response
	if (samsXMLResponseText.includes("<error>")) {
		console.log("🚨 RECEIVED ERROR MESSAGE FOR CLUB " + clubId + "! 🚨");
		console.log(samsXMLResponseText);
		return false;
	}

	// turn the XML string into an Object
	let thisClub: false | Object[] = false;
	const parseString = require("xml2js").parseString;
	await parseString(samsXMLResponseText, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
		if (!err) {
			// console.log("✅ Data for all clubs retrieved. Looks good.");
			// console.log(result);
			thisClub = result.sportsclub;
			return result.sportsclub;
		} else {
			console.log("🚨 COULD NOT CONVERT CLUBS XML TO JSON! 🚨");
			console.log(err);
			return false;
		}
	});

	if (thisClub) return thisClub;
	console.log("🚨 SOMETHING WENT WRONT WHILE RETRIEVING ALL CLUBS! 🚨");
	return false;
}

export async function getClubId(clubName: string): Promise<number | false> {
	const allClubs = await getAllClubs();
	if (!allClubs) return false;

	const filteredAllClubs = allClubs.filter((club: { name: string }) => club.name == clubName);
	return Number(filteredAllClubs[0].id) || false;
}

export async function getClubLogoByName(clubName: string): Promise<string | false> {
	const clubId = await getClubId(clubName);
	if (!clubId) return false;

	if (clubId) {
		const clubData = await getClubData(clubId);
		if (!clubData || !clubData.logo?.url) return false;
		// console.log(clubData.logo.url)
		return clubData.logo.url;
	}

	return false;
}
