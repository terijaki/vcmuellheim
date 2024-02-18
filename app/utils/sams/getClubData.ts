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

export default async function getClubData(clubId?: number): Promise<Object | boolean> {
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
