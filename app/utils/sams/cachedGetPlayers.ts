import fs from "fs";
import path from "path";

const TEAMS_FOLDER = "data/sams/team";

export function cachedGetPlayers(teamId: number | string, playersOnly = true): [playerType] | false {
	const file = path.join(TEAMS_FOLDER, teamId.toString()) + "/players.json";
	if (fs.existsSync(file)) {
		const players = fs.readFileSync(file);
		const playersObject = JSON.parse(players.toString());

		if (playersOnly) {
			const playersFiltered = playersObject.filter((player: playerType) => !player.function);
			return playersFiltered;
		} else {
			return playersObject;
		}
	} else {
		return false;
	}
}

export type playersArray = [playerType];

export type playerType = {
	lastname: string;
	firstname: string;
	nationality?: string;
	number?: number;
	height?: number;
	function?: string;
};
