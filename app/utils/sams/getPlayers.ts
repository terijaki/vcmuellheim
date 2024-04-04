import fs from "fs";
import path from "path";
import { writeToSummary } from "../github/actionSummary";

const SAMS_PLAYER_URL = "https://www.sbvv-online.de/servlet/sportsclub/TeamMemberCsvExport?teamId=";
const TEAM_FOLDER = "data/sams/team";

export default async function getPlayers(teamId: (number | string)[]) {
	// create a new set for the github summary
	let summaryList = new Set<string>();
	let summaryErrorList = new Set<string>();

	// process for each team id
	teamId.forEach(async (id) => {
		const dataUrl: string = SAMS_PLAYER_URL + id;
		// receive the player data from SAMS
		await fetch(dataUrl, { headers: { "Content-Type": "text/html; charset=UTF-8" } })
			.then((response) => response.arrayBuffer())
			.then(async (buffer) => {
				let decoder = new TextDecoder("iso-8859-1"); // this is needed to deal with german Umlauts
				let samsData = decoder.decode(buffer);
				// debug messages
				if (samsData) {
					let consoleNote = "✅ Player data retrieved for team " + teamId;
					console.log(consoleNote);
					summaryList.add(consoleNote);
				}
				// convert it to json
				const dumbcsv = require("dumb-csv");
				const jsonData = await dumbcsv.fromCSV({ data: samsData, separator: ";" }).toJSON();
				// clean the json - only return wanted data and rename it
				const jsonClean = jsonData.map((player: { [x: string]: any }) => {
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
				const targetPath = path.join(TEAM_FOLDER, teamId.toString());
				fs.mkdirSync(targetPath, { recursive: true });
				const targetFile = path.join(targetPath, "players.json");
				fs.writeFileSync(targetFile, JSON.stringify(jsonClean, null, 4));
			})
			.catch((error) => {
				let consoleNote = "🚨 Player data for team " + teamId + " could not be processed correctly: " + error;
				console.log(consoleNote);
				summaryList.add(consoleNote);
				summaryErrorList.add(consoleNote);
			});
	});

	// output summary consolidated or individually
	if (summaryErrorList.size > 0) {
		summaryList.forEach((entry) => {
			writeToSummary(entry);
		});
	} else {
		let consoleNote = "✅ Player data retrieved for all teams.";
		writeToSummary(consoleNote);
	}
}
