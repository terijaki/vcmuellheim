// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Saisonübersicht
// Zeigt eine Liste aller verfügbaren Saisons an. Die ID der Saison kann in der Spielrundenübersicht verwendet werden, um Zugriff auf historische Daten zu erhalten.
import { env } from "process";
import fs from "fs";

const SAMS_API = env.SAMS_API;
const SAMS_URL = env.SAMS_URL;
const JSON_FILE_TARGET = "data/sams/seasons.json";

// fetch Club Data
export function getSeasons() {
	const apiPath = SAMS_URL + "/xml/seasons.xhtml?apiKey=" + SAMS_API;
	fetch(apiPath)
		.then((response) => Promise.all([response.status, response.text()]))
		.then(([status, xmlData]) => {
			console.log("STATUS RESPONSE CODE:" + status);
			if (status == 200) {
				if (!xmlData.includes("<error>")) {
					const parseString = require("xml2js").parseString;
					parseString(xmlData, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
						if (!err) {
							console.log("✅ All good. Writing response to: " + JSON_FILE_TARGET);
							const output = JSON.stringify(result, null, 2);
							fs.writeFileSync(JSON_FILE_TARGET, output);
							return output;
						} else {
							console.log("🚨 COULD NOT CONVERT XML TO JSON! 🚨");
							console.log(err);
							return false;
						}
					});
				} else {
					console.log("🚨 RECEIVED ERROR MESSAGE! 🚨");
					console.log(xmlData);
					return false;
				}
			} else {
				console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE! 🚨");
				return false;
			}
		});
}

getSeasons();
