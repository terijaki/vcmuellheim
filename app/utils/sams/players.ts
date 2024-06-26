const SAMS_PLAYER_URL = "https://www.sbvv-online.de/servlet/sportsclub/TeamMemberCsvExport?teamId=";

export type Player = {
	lastname: string;
	firstname: string;
	nationality?: string;
	number?: number;
	height?: number;
	function?: string;
};
export type TeamPlayers = { date: Date; players?: Player[] };

// TODO descriütion
export async function getTeamPlayers(teamId: number | string): Promise<TeamPlayers | false> {
	if (!teamId) return false;
	// fetch the player data from SAMS' website
	const dataUrl: string = SAMS_PLAYER_URL + teamId;

	const playerCSV = await fetch(dataUrl, { headers: { "Content-Type": "text/html; charset=UTF-8" }, next: { revalidate: 600, tags: ["sams", "players"] } });
	if (!playerCSV) {
		console.log("🚨 CSV player data for team " + teamId + " could not be retrieved");
		return false;
	}
	// decode the response
	let decoder = new TextDecoder("iso-8859-1"); // this is needed to deal with german Umlauts
	let csvString = decoder.decode(await playerCSV.arrayBuffer());

	if (!csvString) {
		console.log("🚨 CSV player data for team " + teamId + " could not be decoded");
		return false;
	}
	// convert it to json
	const dumbcsv = require("dumb-csv");
	const jsonPlayerData = await dumbcsv.fromCSV({ data: csvString, separator: ";" }).toJSON();
	// build the object to be exported
	let jsonData: TeamPlayers = { date: new Date() };
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
	if (!jsonData) return false;

	// return the player data
	return jsonData;
}
