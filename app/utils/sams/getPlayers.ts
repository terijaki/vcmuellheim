import fs from "fs";
import path from "path";
import { writeToSummary } from "../github/actionSummary";

const SAMS_PLAYER_URL = "https://www.sbvv-online.de/servlet/sportsclub/TeamMemberCsvExport?teamId=";
const TEAM_FOLDER = "data/sams/team";

export default async function getPlayers(teamId: number | string) {
	const dataUrl: string = SAMS_PLAYER_URL + teamId;

	const res = await fetch(dataUrl);
	if (res.ok) {
		// read the player data from SAMS
		const samsData = await res.text();
		if (samsData) {
			let consoleNote = "✅ Player data retrieved for team " + teamId;
			console.log(consoleNote);
			writeToSummary(consoleNote);
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
				height: player["Gr��e"],
				function: player["Position/Funktion Offizieller"],
			};
		});
		// store the player data
		const targetPath = path.join(TEAM_FOLDER, teamId.toString());
		fs.mkdirSync(targetPath, { recursive: true });
		const targetFile = path.join(targetPath, "players.json");
		fs.writeFileSync(targetFile, JSON.stringify(jsonClean, null, 4));
	}
}
