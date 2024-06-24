// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Verein (detailliert)
// Gibt detaillierte Informationen zu einem bestimmten Verein aus.
import { env } from "process";
import fs from "fs";
import { error } from "console";

const SAMS_API = env.SAMS_API,
	SAMS_URL = env.SAMS_URL,
	SAMS_CLUB_NAME = env.SAMS_CLUB_NAME,
	SAMS_FOLDER = "data/sams";
export const OWN_CLUB_CACHE_FILE = "data/sams/club.json";

export default async function getClubData(clubId: number): Promise<{ response: { id: number; name: string; logo: string } }> {
	return new Promise(async (resolve, reject) => {
		try {
			const apiPath = await fetch(SAMS_URL + "/xml/sportsclub.xhtml?apiKey=" + SAMS_API + "&sportsclubId=" + clubId, { cache: "force-cache", next: { revalidate: 600, tags: ["sams", "club"] } });
			if (apiPath.status != 200) {
				error("🚨 SAMS API CALL NOT OK FOR CLUB (" + clubId + "). STATUS " + apiPath.status + ": " + apiPath.statusText);
			} else {
				let xmlReponse = await apiPath.text();
				if (xmlReponse.includes("<error>") || xmlReponse.includes("<title>Ausnahmefehler</title>")) {
					error("🚨 SAMS API RETURNED AN ERROR IN THE XML RESPONSE!");
				} else if (!xmlReponse.includes("<id>" + clubId + "</id>")) {
					error("🚨 CLUB DATA RESPONSE BODY DID NOT INCLUDE THE CLUB ID.🚨\nTHIS COULD INDICATE A MAINTENANCE OR SERVER ISSUE.");
				} else {
					const parseString = require("xml2js").parseString;
					parseString(xmlReponse, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
						if (err) {
							console.log(err);
							throw "🚨 COULD NOT CONVERT CLUB DATA XML TO JSON! 🚨";
						} else {
							console.log("✅ Club Data received and looks ok for: " + result.sportsclub.name + " (" + result.sportsclub.id + ")");
							if (SAMS_CLUB_NAME && SAMS_CLUB_NAME == result.sportsclub.name) {
								const output = JSON.stringify(result, null, 2);
								console.log("✅ Club is our own. Caching response to: " + OWN_CLUB_CACHE_FILE);
								fs.mkdirSync(SAMS_FOLDER, { recursive: true });
								fs.writeFileSync(OWN_CLUB_CACHE_FILE, output);
							}
							let clubDataJson = result.sportsclub;
							// console.log(clubDataJson);
							resolve({ response: { id: clubDataJson.id, name: clubDataJson.name, logo: clubDataJson.logo.url } });
						}
					});
				}
			}
		} catch (error) {
			console.log(error);
			reject(error);
		}
	});
}
