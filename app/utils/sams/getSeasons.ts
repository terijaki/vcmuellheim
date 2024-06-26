// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Saisonübersicht
// Zeigt eine Liste aller verfügbaren Saisons an. Die ID der Saison kann in der Spielrundenübersicht verwendet werden, um Zugriff auf historische Daten zu erhalten.
import { env } from "process";
import fs from "fs";

const SAMS_API = env.SAMS_API,
	SAMS_URL = env.NEXT_PUBLIC_SAMS_URL;
export const JSON_FILE_TARGET = "data/sams/seasons.json";

// fetch Club Data
export function getSeasons() {
	const apiPath = SAMS_URL + "/xml/seasons.xhtml?apiKey=" + SAMS_API;
	fetch(apiPath, { cache: "force-cache", next: { revalidate: 600, tags: ["sams", "seasons"] } })
		.then((response) => Promise.all([response.status, response.text()]))
		.then(([status, xmlData]) => {
			if (status == 200) {
				if (!xmlData.includes("<error>")) {
					const parseString = require("xml2js").parseString;
					parseString(xmlData, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
						if (!err) {
							console.log("✅ Season data received. Writing response to: " + JSON_FILE_TARGET);
							const output = JSON.stringify(result, null, 2);
							fs.writeFileSync(JSON_FILE_TARGET, output);
							return output;
						} else {
							console.log("🚨 COULD NOT CONVERT SEASONS XML TO JSON! 🚨");
							console.log(err);
							return false;
						}
					});
				} else {
					console.log("🚨 RECEIVED ERROR MESSAGE FOR SEASONS! 🚨");
					console.log(xmlData);
					return false;
				}
			} else {
				console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR SEASONS! 🚨");
				return false;
			}
		});
}
