// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Vereine
// Gibt eine Übersicht aller Vereine mit wichtigen Informationen aus.
import { env } from "process";
import fs from "fs";
import { writeToSummary } from "../github/actionSummary";

const SAMS_API = env.SAMS_API,
	SAMS_URL = env.SAMS_URL,
	SAMS_FOLDER = "data/sams";

export const CLUBS_FILE_TARGET = "data/sams/allClubs.json";

export type clubData = { sportsclubs: { sportsclub: [{ id: string; name: string; lsbNumber: string; internalSportsclubId: string; association: { id: string; name: string } }] } };

export default async function getAllClubs(): Promise<string | false> {
	const apiPath = SAMS_URL + "/xml/sportsclubList.xhtml?apiKey=" + SAMS_API;
	let outputAll: string | false = false;
	await fetch(apiPath)
		.then((response) => Promise.all([response.status, response.text()]))
		.then(([status, xmlData]) => {
			if (status == 200) {
				if (!xmlData.includes("<error>")) {
					const parseString = require("xml2js").parseString;
					parseString(xmlData, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
						if (!err) {
							console.log("✅ Data for all clubs retrieved. Looks good. Writing response to: " + CLUBS_FILE_TARGET);
							const output = JSON.stringify(result, null, 2);
							fs.mkdirSync(SAMS_FOLDER, { recursive: true });
							fs.writeFileSync(CLUBS_FILE_TARGET, output);
							outputAll = output;
						} else {
							let message = "🚨 COULD NOT CONVERT CLUBS XML TO JSON! 🚨";
							console.log(message);
							console.log(err);
							writeToSummary(message);
							return false;
						}
					});
				} else {
					let message = "🚨 RECEIVED ERROR MESSAGE FOR CLUBS DATA! 🚨";
					console.log(message);
					console.log(xmlData);
					writeToSummary(message);
					return false;
				}
			} else {
				let message = "🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR CLUBS! 🚨";
				console.log(message);
				writeToSummary(message);
				return false;
			}
		});
	return outputAll;
}
