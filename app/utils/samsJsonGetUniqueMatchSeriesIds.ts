import fs from "fs";
import { getTeamIds } from "@/app/utils/samsJsonGetTeamIds";

const CLUB_SAMS_FILE = "data/sams/club.json";

export function getMatchSeriesId(teamId: string | number): string {
	const clubdata = fs.readFileSync(CLUB_SAMS_FILE);
	const clubDataObject = JSON.parse(clubdata.toString());
	const teams = clubDataObject.sportsclub.teams.team;
	let result = "";
	teams.forEach((team: { matchSeries: any; id: string | number }) => {
		if (team.id.toString() == teamId.toString()) {
			result = team.matchSeries.id.toString();
		}
	});
	return result;
}

export function getUniqueMatchSeriesIds(teamIds?: (string | number)[]): string[] {
	// returns the match Series Ids without duplicates
	// if no teamId parameter is provided, the function fetches ids of league teams from the club file itself
	let UniqueMatchSeriesIds = new Array();
	if (!teamIds) {
		teamIds = getTeamIds("id");
	}
	teamIds.map((team) => {
		const matchSeriesId = getMatchSeriesId(team);
		if (!UniqueMatchSeriesIds.includes(matchSeriesId)) {
			UniqueMatchSeriesIds.push(matchSeriesId.toString());
		}
	});
	// console.log(UniqueMatchSeriesIds);
	return UniqueMatchSeriesIds;
}

getUniqueMatchSeriesIds();
