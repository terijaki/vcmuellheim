// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Tabellen
// Gibt die aktuelle Tabelle einer Liga oder eines Wettbewerbs aus.
// URL: https://<verbandsadresse>/xml/rankings.xhtml
// Beispiel: https://www.volleyball-bundesliga.de/xml/rankings.xhtml?apiKey=XXXXXXXXXXXXXXXXXXXXXX&matchSeriesId=12345
// benötiger Parameter:
// matchSeriesId - Id einer Spielrunde (Bsp.: matchSeriesId=12345)
// alternativ: allSeasonMatchSeriesId - saisonübergreifende Spielrunden-ID (Bsp.: allSeasonMatchSeriesId=012bfd2f-ad4a-40f5-8cef-a88e6a27a3aa)
import { env } from "process";
import fs from "fs";
import path from "path";

const SAMS_API = env.SAMS_API,
	SAMS_URL = env.SAMS_URL;
export const JSON_FILE_TARGET = "data/sams";

// fetch Rankings Data
export default function getRankings(matchSeriesId?: string | number, allSeasonMatchSeriesId?: string): Object | void {
	let apiPath: string;
	let folderTarget: string;
	let fileTarget: string;

	if (matchSeriesId) {
		apiPath = SAMS_URL + "/xml/rankings.xhtml?apiKey=" + SAMS_API + "&matchSeriesId=" + matchSeriesId;
		folderTarget = path.join(JSON_FILE_TARGET, "matchSeriesId", matchSeriesId.toString());
		fileTarget = folderTarget + "/rankings.json";
	} else if (allSeasonMatchSeriesId) {
		apiPath = SAMS_URL + "/xml/rankings.xhtml?apiKey=" + SAMS_API + "&matchSeriesId=" + allSeasonMatchSeriesId;
		folderTarget = path.join(JSON_FILE_TARGET, "allSeasonMatchSeriesId", allSeasonMatchSeriesId.toString());
		fileTarget = folderTarget + "/rankings.json";
	} else {
		return false;
	}
	if (apiPath && folderTarget && fileTarget) {
		fetch(apiPath)
			.then((response) => Promise.all([response.status, response.text()]))
			.then(([status, xmlData]) => {
				// console.log("STATUS RESPONSE CODE:" + status);
				if (status == 200) {
					if (!xmlData.includes("<error>")) {
						const parseString = require("xml2js").parseString;
						parseString(xmlData, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
							if (!err) {
								console.log("✅ Ranking data looks good. Writing response to: " + fileTarget);
								const output = JSON.stringify(result, null, 2);
								fs.mkdirSync(folderTarget, { recursive: true });
								fs.writeFileSync(fileTarget, output);
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
}
