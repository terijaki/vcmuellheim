// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Spielplan und Ergebnisse
// Erzeugt eine Liste aller Spiele für eine Spielrunde, Mannschaft und/oder in einem bestimmten Zeitraum.
// URL: https://<verbandsadresse>/xml/matches.xhtml
// Beispiel: https://www.volleyball-bundesliga.de/xml/matches.xhtml?apiKey=XXXXXXXXXXXXXXXXXXXXXX&before=2012-03-01&after=2012-02-01
// optionale Parameter:
// matchSeriesId - Id einer Spielrunde (Bsp.: matchSeriesId=12345)
// alternativ: allSeasonMatchSeriesId - saisonübergreifende Spielrunden-ID (Bsp.: allSeasonMatchSeriesId=012bfd2f-ad4a-40f5-8cef-a88e6a27a3aa)
// teamId - Id einer Mannschaft (Bsp.: teamId=12345)
// before - Datum im Format tt.mm.jjjj oder jjjj-mm-tt, vor dem die Spiele liegen sollen (Bsp.: before=31.01.2012)
// after - Datum im Format tt.mm.jjjj oder jjjj-mm-tt, nach dem die Spiele liegen sollen, Standardwert ist Saisonbeginn (Bsp.: after=2011-12-01)
// past - Überschreibt before und zeigt alle Spiele aus der Vergangenheit, wenn der Parameter "true" ist. (Bsp.: past=true)
// future=true - diesen Parameter nutzen Sie für die Anzeige zukünftiger Spiele und in Verbindung mit dem Parameter limit=nummerischer Wert begrenzen Sie die Anzahl der Ausgabe (Bsp.: future=true&limit=3, weist die nächsten 3 Spiele aus)
// Sind weder matchSeriesId noch teamId gegeben, dürfen before und after nicht weiter als 31 Tage auseinander liegen.
import { env } from "process";
import fs from "fs";
import path from "path";
import { writeToSummary } from "../github/actionSummary";
import convertDate from "./convertDate";
import { matchType, matchesType } from "./typeMatches";
import { identifyNewMatchResults } from "./identifyNewMatchResults";
import { SAMS } from "@/project.config";

const SAMS_API = env.SAMS_API,
	SAMS_URL = SAMS.url;
export const JSON_FILE_TARGET = "data/sams";

// fetch Club Data
export default function getMatches(teamId?: string | number, matchSeriesId?: string | number, allSeasonMatchSeriesId?: string, pastOffset = 20, futureOffset = 10): matchType | void {
	const dateAfter = new Date();
	const dateBefore = new Date();
	dateAfter.setDate(dateAfter.getDate() - pastOffset); // 20 days in the past
	dateBefore.setDate(dateBefore.getDate() + futureOffset); // 10 days in the future
	let apiPath = SAMS_URL + "/xml/matches.xhtml?apiKey=" + SAMS_API + "&after=" + dateAfter.toISOString().slice(0, 10) + "&before=" + dateBefore.toISOString().slice(0, 10);
	let folderTarget = JSON_FILE_TARGET;
	let fileTarget = folderTarget + "/matches.json";
	let queryContext: string;
	let matchRequestId: string;

	if (teamId) {
		apiPath = SAMS_URL + "/xml/matches.xhtml?apiKey=" + SAMS_API + "&teamId=" + teamId;
		folderTarget = path.join(JSON_FILE_TARGET, "teamId", teamId.toString());
		fileTarget = folderTarget + "/matches.json";
		queryContext = "Team (" + teamId + ")";
		matchRequestId = teamId.toString();
	} else if (matchSeriesId) {
		apiPath = SAMS_URL + "/xml/matches.xhtml?apiKey=" + SAMS_API + "&matchSeriesId=" + matchSeriesId;
		folderTarget = path.join(JSON_FILE_TARGET, "matchSeriesId", matchSeriesId.toString());
		fileTarget = folderTarget + "/matches.json";
		queryContext = "MatchSeries (" + matchSeriesId + ")";
		matchRequestId = matchSeriesId.toString();
	} else if (allSeasonMatchSeriesId) {
		apiPath = SAMS_URL + "/xml/matches.xhtml?apiKey=" + SAMS_API + "&matchSeriesId=" + allSeasonMatchSeriesId;
		folderTarget = path.join(JSON_FILE_TARGET, "allSeasonMatchSeriesId", allSeasonMatchSeriesId.toString());
		fileTarget = folderTarget + "/matches.json";
		queryContext = "All-Season-MatchSeries (" + allSeasonMatchSeriesId + ")";
		matchRequestId = allSeasonMatchSeriesId.toString();
	}
	fetch(apiPath, { cache: "force-cache", next: { revalidate: 600, tags: ["sams", "matches"] } })
		.then((response) => Promise.all([response.status, response.text()]))
		.then(([status, xmlData]) => {
			// console.log("STATUS RESPONSE CODE:" + status);
			if (status == 200) {
				if (!xmlData.includes("<error>")) {
					const parseString = require("xml2js").parseString;
					parseString(xmlData, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: matchesType) {
						if (!err) {
							let message = "🏐 Match data for " + queryContext + " received. Writing response to: " + fileTarget;
							console.log(message);
							writeToSummary(message);
							// add date Object and ISO so other areas of the app can use this more conviniently
							result.matches.match.map((match) => {
								match.dateObject = convertDate(match.date, match.time);
								match.dateIso = match.dateObject.toISOString();
							});
							// cache the data
							const output = JSON.stringify(result, null, 2);
							fs.mkdirSync(folderTarget, { recursive: true });
							fs.writeFileSync(fileTarget, output);
							// check for new match results
							identifyNewMatchResults(output);
							return output;
						} else {
							console.log("🚨 COULD NOT CONVERT MATCH DATA (" + matchRequestId + ") XML TO JSON! 🚨");
							console.log(err);
							return false;
						}
					});
				} else {
					console.log("🚨 RECEIVED ERROR MESSAGE FOR MATCH DATA (" + matchRequestId + ")! 🚨");
					console.log(xmlData);
					return false;
				}
			} else {
				console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR MATCH DATA (" + matchRequestId + ")! 🚨");
				return false;
			}
		});
}
