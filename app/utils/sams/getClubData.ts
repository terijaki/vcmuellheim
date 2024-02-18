// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Verein (detailliert)
// Gibt detaillierte Informationen zu einem bestimmten Verein aus.
import { env } from "process";
import fs from "fs";

const SAMS_API = env.SAMS_API,
	SAMS_URL = env.SAMS_URL,
	SAMS_CLUB_ID = env.SAMS_CLUBID,
	SAMS_FOLDER = "data/sams",
	OWN_CLUB_CACHE_FILE = "data/sams/club.json";

export default async function getClubData(clubId?: number): Promise<{ response: { id: number; name: string; logo: string } }> {
	if (!clubId && SAMS_CLUB_ID) {
		const clubId = Number(SAMS_CLUB_ID);
	}
	return new Promise(async (resolve, reject) => {
		try {
			const apiPath = await fetch(SAMS_URL + "/xml/sportsclub.xhtml?apiKey=" + SAMS_API + "&sportsclubId=" + clubId);
			if (apiPath.status != 200) {
				throw "🚨 SAMS API CALL NOT OK. STATUS " + apiPath.status + ": " + apiPath.statusText;
			}
			let xmlReponse = await apiPath.text();
			if (xmlReponse.includes("<error>")) {
				throw "🚨 SAMS API RETURNED AN ERROR IN THE XML RESPONSE!";
			} else if (!xmlReponse.includes("<id>" + clubId + "</id>")) {
				throw "🚨 CLUB DATA RESPONSE BODY DID NOT INCLUDE THE CLUB ID.🚨\nTHIS COULD INDICATE A MAINTENANCE OR SERVER ISSUE.";
			} else {
				const parseString = require("xml2js").parseString;
				parseString(xmlReponse, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
					if (!err) {
						console.log("✅ Club Data looks ok: " + result.sportsclub.name + "(" + result.sportsclub.id + ")");
						if (clubId == Number(SAMS_CLUB_ID)) {
							const output = JSON.stringify(result, null, 2);
							console.log("✅ Club is our own. Caching response to: " + OWN_CLUB_CACHE_FILE);
							fs.mkdirSync(SAMS_FOLDER, { recursive: true });
							fs.writeFileSync(OWN_CLUB_CACHE_FILE, output);
						}
						let clubDataJson = result.sportsclub;
						// console.log(clubDataJson);
						resolve({ response: { id: clubDataJson.id, name: clubDataJson.name, logo: clubDataJson.logo.url } });
					} else {
						console.log(err);
						throw "🚨 COULD NOT CONVERT CLUB DATA XML TO JSON! 🚨";
					}
				});
			}
		} catch (error) {
			console.log(error);
			reject(error);
		}
	});
}

/// TODO: remove this backup funciton if everything works fine
export async function getClubDataOld(clubId?: number): Promise<Object | boolean> {
	if (!clubId) {
		const clubId = SAMS_CLUB_ID;
	}

	const apiPath = SAMS_URL + "/xml/sportsclub.xhtml?apiKey=" + SAMS_API + "&sportsclubId=" + clubId;
	// fetch Club Data
	await fetch(apiPath)
		.then((response) => Promise.all([response.status, response.text()]))
		.then(([status, xmlData]) => {
			// verify the status code
			if (status == 200) {
				// unfortunately some errors such as rate limits, maintenance mode etc, come in as status 200 and then the error message is in the body
				if (!xmlData.includes("<error>")) {
					// verify the response includes our club ID
					if (xmlData.includes("<id>" + clubId + "</id>")) {
						const parseString = require("xml2js").parseString;
						parseString(xmlData, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
							if (!err) {
								console.log("✅ Club Data looks ok: " + result.sportsclub.name + "(" + result.sportsclub.id + ")");
								if (clubId == SAMS_CLUB_ID) {
									const output = JSON.stringify(result, null, 2);
									console.log("✅ Club is our own. Caching response to: " + OWN_CLUB_CACHE_FILE);
									fs.mkdirSync(SAMS_FOLDER, { recursive: true });
									fs.writeFileSync(OWN_CLUB_CACHE_FILE, output);
								}
								return result.sportsclub;
							} else {
								console.log("🚨 COULD NOT CONVERT CLUB DATA XML TO JSON! 🚨");
								console.log(err);
								return false;
							}
						});
					} else {
						console.log("🚨 CLUB DATA RESPONSE BODY DID NOT INCLUDE THE CLUB ID.🚨\nTHIS COULD INDICATE A MAINTENANCE OR SERVER ISSUE.");
						console.log(xmlData);
						return false;
					}
				} else {
					console.log("🚨 RECEIVED ERROR MESSAGE FOR CLUB DATA! 🚨");
					console.log(xmlData);
					return false;
				}
			} else {
				console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR CLUB DATA! 🚨");
				return false;
			}
		});

	return true;
}
