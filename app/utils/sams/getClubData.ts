// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Verein (detailliert)
// Gibt detaillierte Informationen zu einem bestimmten Verein aus.
import { env } from "process";
import fs from "fs";

const SAMS_API = env.SAMS_API,
	SAMS_URL = env.SAMS_URL,
	SAMS_CLUB_ID = env.SAMS_CLUBID,
	JSON_FILE_TARGET = "data/sams/club.json";

export default async function getClubData(): Promise<Object | boolean> {
	const apiPath = SAMS_URL + "/xml/sportsclub.xhtml?apiKey=" + SAMS_API + "&sportsclubId=" + SAMS_CLUB_ID;
	// fetch Club Data
	await fetch(apiPath)
		.then((response) => Promise.all([response.status, response.text()]))
		.then(([status, xmlData]) => {
			// console.log("CLUB DATA STATUS RESPONSE CODE:" + status);
			// verify the status code
			if (status == 200) {
				// unfortunately some errors such as rate limits, maintenance mode etc, come in as status 200 and then the error message is in the body
				if (!xmlData.includes("<error>")) {
					// verify the response includes our club ID
					if (xmlData.includes("<id>" + SAMS_CLUB_ID + "</id>")) {
						const parseString = require("xml2js").parseString;
						parseString(xmlData, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
							if (!err) {
								console.log("✅ Club Data looks good. Writing response to: " + JSON_FILE_TARGET);
								const output = JSON.stringify(result, null, 2);
								fs.writeFileSync(JSON_FILE_TARGET, output);
								return output;
							} else {
								console.log("🚨 COULD NOT CONVERT CLUB DATA XML TO JSON! 🚨");
								console.log(err);
								return false;
							}
						});
					} else {
						console.log("🚨 CLUB DATA RESPONSE BODY DID NOT INCLUDE OUR CLUB ID.🚨\nTHIS COULD INDICATE A MAINTENANCE OR SERVER ISSUE.");
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
