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
import { SAMS } from "@/project.config";
import { unstable_cache } from "next/cache";
import { env } from "process";
import { makeArrayUnique } from "../makeArrayUnique";

const SAMS_API = env.SAMS_API,
	SAMS_URL = SAMS.url,
	SAMS_CACHE = env.SAMS_CACHE || ".temp/sams";

/** Returns a array of basic club data for each club. No input required. */
export async function getAllClubs() {
	//#region caching since the response is likely to be larger than 2MB
	// const cacheFile = Bun.file(path.join(SAMS_CACHE, "allClubs.json"), { type: "application/json" });
	// if (await cacheFile.exists()) {
	// 	const cacheAge = (new Date().getTime() - cacheFile.lastModified) / (1000 * 60 * 60 * 24); // in days
	// 	if (cacheAge < 7) {
	// 		const cacheData = await cacheFile.json();
	// 		return cacheData;
	// 	}
	// }
	//#endregion caching

	if (!SAMS_API) {
		console.error("🚨 SAMS API KEY MISSING IN FETCH ALL CLUBS CONTEXT");
		return false;
	}
	const samsJson = unstable_cache(
		async () => {
			const apiURL = SAMS_URL + "/xml/sportsclubList.xhtml?apiKey=" + SAMS_API;

			try {
				const samsRequest = await fetch(apiURL, { method: "POST", cache: "force-cache" });
				console.log(samsRequest);
				// make the server request and check its status
				if (!samsRequest.status || samsRequest.status != 200) {
					console.error("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR ALL CLUBS! 🚨 ERROR: " + samsRequest.status);
					return false;
				}
				// read the XML response
				const samsXMLResponseText = await samsRequest.text(); // this is the XML response
				if (!samsXMLResponseText) {
					console.error("🚨 EMPTY RESPONSE RECEIVED FOR ALL CLUBS! 🚨");
					return false;
				} else if (samsXMLResponseText.includes("<error>")) {
					console.error("🚨 RECEIVED ERROR MESSAGE FOR ALL CLUBS! 🚨");
					console.error(samsXMLResponseText);
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
							// Bun.write(cacheFile, JSON.stringify(allClubs));
							return allClubs;
						}
					} else {
						console.error("🚨 COULD NOT CONVERT CLUBS XML TO JSON! 🚨");
						console.error(err);
						return false;
					}
				});
				if (allClubs) return allClubs;
				console.error("🚨 SOMETHING WENT WRONT WHILE RETRIEVING ALL CLUBS! 🚨");
			} catch (error) {
				console.error("🚨 SOMETHING WENT WRONG FETCHING ALL CLUBS! 🚨", error);
			}
		},
		["sams-all-clubs"],
		{ revalidate: 60 * 60 }
	);

	return samsJson;

	return false;
}

/** Returns the full club information for the club ID provides. */
export async function getClubData(clubId: number | string): Promise<Club | false> {
	//#region caching since the response is likely to be larger than 2MB
	// const cacheFile = Bun.file(path.join(SAMS_CACHE, "club", clubId + ".json"), { type: "application/json" });
	// if (await cacheFile.exists()) {
	// 	const cacheAge = (new Date().getTime() - cacheFile.lastModified) / (1000 * 60 * 60 * 24); // in days
	// 	if (cacheAge < 3) {
	// 		const cacheData = await cacheFile.json();
	// 		return cacheData;
	// 	}
	// }
	//#endregion caching

	if (!SAMS_API) {
		console.log("🚨 SAMS API KEY MISSING IN FETCH CLUB DATA CONTEXT");
		return false;
	}

	const apiURL = SAMS_URL + "/xml/sportsclub.xhtml?apiKey=" + SAMS_API + "&sportsclubId=" + clubId;

	const samsRequest = await fetch(apiURL, { next: { revalidate: 3600, tags: ["sams", "club", clubId.toString()] } });

	// make the server request and check its status
	if (samsRequest.status != 200) {
		console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR CLUB " + clubId + "! 🚨 ERROR: " + samsRequest.status);
		return false;
	}
	// read the XML response
	const samsXMLResponseText = await samsRequest.text(); // this is the XML response
	if (!samsXMLResponseText || !samsXMLResponseText.includes("<sportsclub>")) {
		console.log("🚨 EMPTY RESPONSE RECEIVED FOR CLUB " + clubId + "! 🚨");
		console.log(samsXMLResponseText);
		return false;
	} else if (samsXMLResponseText.includes("<error>")) {
		console.log("🚨 RECEIVED ERROR MESSAGE FOR CLUB " + clubId + "! 🚨");
		console.log(samsXMLResponseText);
		return false;
	}

	// turn the XML string into an Object
	let thisClub: false | Club = false;
	const parseString = require("xml2js").parseString;
	await parseString(samsXMLResponseText, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
		if (!err) {
			// console.log("✅ Data for all clubs retrieved. Looks good.");
			// console.log(result);
			thisClub = result.sportsclub;
			// Bun.write(cacheFile, JSON.stringify(thisClub));
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

/** Get a club's ID by it's name. */
export async function getClubId(clubName: string): Promise<(number | string) | false> {
	try {
		if (!clubName) return false;
		const allClubs = await getAllClubs();
		if (!allClubs) return false;
		const filteredAllClubs = allClubs.filter((club: { name: string }) => club.name == clubName);
		return filteredAllClubs[0].id || false;
	} catch (error) {
		console.log("Unable to get Club ID for " + clubName);
		console.log(error);
		return false;
	}
}

/** In 2024 SAMS united across federal states and since then this is the "internalSportsclubId" and no longer the "clubId"
 * @param sportsclubId (4 digits)
 * @returns **clubId** (8 digits) */
export async function getClubIdBySportsclubId(sportsClubId: number | string): Promise<number | false> {
	try {
		if (!sportsClubId) return false;
		const allClubs = await getAllClubs();
		if (!allClubs) return false;

		const filteredAllClubs = allClubs.filter((club: { internalSportsclubId: string }) => club.internalSportsclubId == sportsClubId.toString());
		if (!filteredAllClubs || !filteredAllClubs[0].id) return false;
		return Number(filteredAllClubs[0].id) || false;
	} catch (error) {
		console.log(error);
		return false;
	}
}

/** Retrieve a club's logo by its name. This is useful for ranking displays since the ranking data does not contain this data unfortunately. */
export async function getClubLogoByName(clubName: string): Promise<string | false> {
	try {
		const clubId = await getClubId(clubName);
		if (!clubId) return false;
		if (clubId) {
			const clubData = await getClubData(clubId);
			if (!clubData || !clubData.logo?.url) return false;
			return clubData.logo.url;
		}
		return false;
	} catch (error) {
		console.log("Encountered problem when retriving the Logo for " + clubName);
		console.log(error);
		return false;
	}
}

/** Get the club details and isolate the TeamIds from each team.
 * Results can be filtered to include all teams or only league teams, to filter out championships (one off tournaments).*/
export async function getClubsTeamIds(idType: "id" | "uuid" | "seasonTeamId" | "matchSeriesId" | "matchSeriesAllSeasonId" = "id", leagueOnly: boolean = true, clubId?: number | string): Promise<(string | number)[] | false> {
	try {
		const idToUse = clubId || (await getClubIdBySportsclubId(SAMS.vereinsnummer)); // either use the clubId prop if present or fallback to the project config
		if (!idToUse) return false;

		const clubData = await getClubData(idToUse);
		if (!clubData || !clubData.teams) return false;
		const teams = clubData.teams.team;
		if (!teams) return false;

		let teamIds = new Array();
		teams.forEach((team) => {
			if (team.status == "ACTIVE") {
				if (leagueOnly && team.matchSeries?.type == "League") {
					if (idType == "matchSeriesId") {
						teamIds.push(team.matchSeries.id);
					} else if (idType == "matchSeriesAllSeasonId") {
						teamIds.push(team.matchSeries.allSeasonId);
					} else {
						teamIds.push(team[idType]);
					}
				} else if (!leagueOnly) {
					if (idType == "matchSeriesId") {
						teamIds.push(team.matchSeries?.id);
					} else if (idType == "matchSeriesAllSeasonId") {
						teamIds.push(team.matchSeries?.allSeasonId);
					} else {
						teamIds.push(team[idType]);
					}
				}
			}
		});
		teamIds = makeArrayUnique(teamIds);
		return teamIds;
	} catch (error) {
		console.log("Unable to get our club's SportsClubId");
		console.log(error);
		return false;
	}
}

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
