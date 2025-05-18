import { unstable_cacheLife as cacheLife } from "next/cache";

const SAMS_PLAYER_URL = "https://www.sbvv-online.de/servlet/sportsclub/TeamMemberCsvExport?teamId=";

export type Player = {
	fistName: string;
	lastName: string;
	nationality?: string;
	number?: number;
	height?: number;
	function?: string;
};
export type TeamPlayers = { date: Date; players?: Player[] };

// TODO descriütion
export async function samsPlayers(teamId: number | string): Promise<TeamPlayers | undefined> {
	"use cache";
	cacheLife("days");

	try {
		if (!teamId) throw "No teamId provided to fetch player data";
		// fetch the player data from SAMS' website
		const dataUrl: string = SAMS_PLAYER_URL + teamId;
		const data = await fetch(dataUrl, {
			headers: { "Content-Type": "text/csv; charset=UTF-8" },
			next: { revalidate: 3600 * 24, tags: ["sams", "players"] },
		});
		if (!data) throw `CSV player data for team ${teamId} could not be retrieved`;

		// decode the response
		const decoder = new TextDecoder("iso-8859-1"); // this is needed to deal with german Umlauts
		const csvString = decoder.decode(await data.arrayBuffer());
		if (!csvString) throw `🚨 CSV player data for team ${teamId} could not be decoded`;

		// convert it to json
		const dumbcsv = require("dumb-csv");
		const jsonPlayerData = await dumbcsv.fromCSV({ data: csvString, separator: ";" }).toJSON();
		// build the object to be exported
		const jsonData: TeamPlayers = { date: new Date() };
		// add the relevant player data with simplified terminology
		jsonData.players = jsonPlayerData.map((player: { [x: string]: string | number | undefined }) => {
			return {
				// biome-ignore lint/complexity/useLiteralKeys: Umlauts
				lastName: player["Nachname"],
				// biome-ignore lint/complexity/useLiteralKeys: Umlauts
				firstName: player["Vorname"],
				// biome-ignore lint/complexity/useLiteralKeys: Umlauts
				nationality: player["NAT"],
				// biome-ignore lint/complexity/useLiteralKeys: Umlauts
				number: player["Trikot"],
				// biome-ignore lint/complexity/useLiteralKeys: Umlauts
				height: player["Größe"],
				function: player["Position/Funktion Offizieller"],
			};
		});
		if (!jsonData) throw `🚨 CSV player data for team ${teamId} could not be converted to JSON`;

		// return the player data
		return jsonData;
	} catch (error) {
		console.log(`🚨 CSV player data for team ${teamId} could not be retrieved`);
		
	}
}
