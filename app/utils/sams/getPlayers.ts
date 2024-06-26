import fs from "fs";
import path from "path";
import { writeToSummary } from "../github/actionSummary";

const SAMS_PLAYER_URL = "https://www.sbvv-online.de/servlet/sportsclub/TeamMemberCsvExport?teamId=";
export const TEAM_FOLDER = "data/sams/team";

export type playerType = {
	lastname: string;
	firstname: string;
	nationality?: string;
	number?: number;
	height?: number;
	function?: string;
};
export type playersType = { date: Date; players?: [playerType] };

export default async function getPlayers(teamId: (number | string)[]) {
	// create a new set for the github summary
	let summaryList = new Set<string>();
	let summaryErrorList = new Set<string>();

	// process for each team id
	for (const id of teamId) {
		const targetPath = path.join(TEAM_FOLDER, id.toString());
		const targetFile = path.join(targetPath, "players.json");
		// check if the player data already exists and its not older than 3 days
		if (fs.existsSync(targetFile)) {
			const existingFile = fs.readFileSync(targetFile);
			const existingJsonObject = JSON.parse(existingFile.toString());
			// set the age of the cache file after it needs to be updated
			const cacheTTL = 3,
				today = new Date(),
				cacheTTLDate = new Date(today.setDate(today.getDate() - cacheTTL)).getTime();
			if (cacheTTLDate > new Date(existingJsonObject.date).getTime()) {
				const dataUrl: string = SAMS_PLAYER_URL + id;
				// receive the player data from SAMS
				await fetch(dataUrl, { headers: { "Content-Type": "text/html; charset=UTF-8" }, next: { revalidate: 600, tags: ["sams", "players"] } })
					.then((response) => response.arrayBuffer())
					.then(async (buffer) => {
						let decoder = new TextDecoder("iso-8859-1"); // this is needed to deal with german Umlauts
						let samsData = decoder.decode(buffer);
						// debug messages
						if (samsData) {
							let consoleNote = "✅ Player data retrieved for team " + id;
							console.log(consoleNote);
							summaryList.add(consoleNote);
						}
						// convert it to json
						const dumbcsv = require("dumb-csv");
						const jsonPlayerData = await dumbcsv.fromCSV({ data: samsData, separator: ";" }).toJSON();
						// build the object to be exported
						let jsonData: playersType = { date: new Date() };
						// add the relevant player data with simplified terminology
						jsonData.players = jsonPlayerData.map((player: { [x: string]: any }) => {
							return {
								lastname: player["Nachname"],
								firstname: player["Vorname"],
								nationality: player["NAT"],
								number: player["Trikot"],
								height: player["Größe"],
								function: player["Position/Funktion Offizieller"],
							};
						});
						// store the player data
						fs.mkdirSync(targetPath, { recursive: true });
						fs.writeFileSync(targetFile, JSON.stringify(jsonData, null, 4));
					})
					.catch((error) => {
						let consoleNote = "🚨 Player data for team " + teamId + " could not be processed correctly: " + error;
						console.log(consoleNote);
						summaryList.add(consoleNote);
						summaryErrorList.add(consoleNote);
					});
			}
		}
	}

	// output summary consolidated or individually
	if (summaryErrorList.size > 0) {
		summaryList.forEach((entry) => {
			writeToSummary(entry);
		});
	} else if (summaryList.size > 0) {
		let consoleNote = "✅ Player data retrieved for some teams.";
		writeToSummary(consoleNote);
	} else {
		let consoleNote = "✅ Player data for all teams still fresh.";
		writeToSummary(consoleNote);
	}
}
