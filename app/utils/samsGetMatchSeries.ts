// http://wiki.sams-server.de/wiki/XML-Schnittstelle
// Spielrundenübersicht
// Zeigt eine Liste alle aktuell verfügbaren Ligen und Wettbewerbe an. Hier finden sich auch die IDs (matchSeriesId) der Spielrunden (intern "match series"), die für die weiteren Abfragen relevant sind. Die Spielrunden-ID ist saisonabhängig, um den Abruf von Daten aus alten Saisons zu ermöglichen. Seit Januar 2016 ist zudem eine allSeasonMatchSeriesId verfügbar, die saisonübergreifend ist. Wird diese ID zum Abruf der Schnittstellen verwendet, werden immer Daten der Spielrunde aus der jeweils aktuellen Saison zurückgegeben. Die saisonübergreifenden IDs sind als UUID hinterlegt und somit über alle SAMS-Datenbanken hinweg eindeutig.
// Weiterhin hervorzuheben sind die Parameter <structureUpdated> und <resultsUpdated>, die den Zeitpunkt der letzten Änderung an der Struktur (Spielpan, Termine, etc.) beziehungsweise an den Ergebnissen enthalten. Erst wenn sich dieser Zeitpunkt ändert, sollten die entsprechenden Abfragen durchgeführt und lokal zur weiteren Verwendung abgespeichert werden. Um diese Vorgehensweise zu fördern, gibt es kein Aufruflimit bei der Abfrage der Spielrundenübersicht.
// In dieser Schnittstelle wird zusätzlich die hierarchische Struktur jeder Liga ausgegeben. Jede Spielrunde ist einer Hierarchie zugeordnet; jede Hierarchie kann mehrere Spielrunden sowie weitere untergeordnete Hierarchien enthalten. Die Hierarchien werden von jedem Verband frei definiert und dienen der organisatorischen Strukturierung der Spielrunden. Im direkt zugeordneten Element <hierarchy> ist die direkte Hierarchie der Liga hinterlegt. Im Element <fullHierarchy> finden sich alle Hierarchien, denen diese Liga untergeordnet ist. Jedes <hierarchy>-Element besitzt einen <hierarchyLevel>, der die Anzahl der übergeordneten Hierarchien angibt. Hierarchien mit <hierarchyLevel>0</hierarchyLevel> besitzen keine weiteren übergeordneten Hierarchien.
import { env } from "process";
import fs from "fs";

const SAMS_API = env.SAMS_API;
const SAMS_URL = env.SAMS_URL;
const JSON_FILE_TARGET = "data/sams/matchSeries.json";

// fetch Club Data
export default async function getMatchSeries(): Promise<Object | boolean> {
	const apiPath = SAMS_URL + "/xml/matchSeries.xhtml?apiKey=" + SAMS_API;
	await fetch(apiPath)
		.then((response) => Promise.all([response.status, response.text()]))
		.then(([status, xmlData]) => {
			console.log("MATCH SERIES STATUS RESPONSE CODE:" + status);
			if (status == 200) {
				if (!xmlData.includes("<error>")) {
					const parseString = require("xml2js").parseString;
					parseString(xmlData, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, function (err: any, result: any) {
						if (!err) {
							console.log("✅ Match Series retrieved. Looks good. Writing response to: " + JSON_FILE_TARGET);
							const output = JSON.stringify(result, null, 2);
							fs.writeFileSync(JSON_FILE_TARGET, output);
							return output;
						} else {
							console.log("🚨 COULD NOT CONVERT MATCH SERIES XML TO JSON! 🚨");
							console.log(err);
							return false;
						}
					});
				} else {
					console.log("🚨 RECEIVED ERROR MESSAGE FOR MATCH SERIES! 🚨");
					console.log(xmlData);
					return false;
				}
			} else {
				console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR MATCH SERIES! 🚨");
				return false;
			}
		});
	return true;
}
