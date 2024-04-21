import fs from "fs";
import path from "path";
import { playersType, playerType, TEAM_FOLDER } from "./getPlayers";

export function cachedGetPlayers(teamId: number | string, playersOnly = true): playerType[] | false | undefined {
	const file = path.join(TEAM_FOLDER, teamId.toString()) + "/players.json";
	if (fs.existsSync(file)) {
		const players = fs.readFileSync(file);
		const playersObject: playersType = JSON.parse(players.toString());
		if (playersObject.players) {
			if (playersOnly) {
				const playersFiltered = playersObject.players.filter((player: playerType) => !player.function);
				return playersFiltered;
			} else {
				return playersObject.players;
			}
		} else {
			return false;
		}
	} else {
		return false;
	}
}
