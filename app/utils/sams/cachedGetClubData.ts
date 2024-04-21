import fs from "fs";
import { OWN_CLUB_CACHE_FILE as CLUB_SAMS_FILE } from "./getClubData";

export function cachedGetTeamIds(idType: "id" | "uuid" | "seasonTeamId" = "id", leagueOnly: boolean = true): string[] {
	const clubdata = fs.readFileSync(CLUB_SAMS_FILE);
	const clubDataObject = JSON.parse(clubdata.toString());
	const teams = clubDataObject.sportsclub.teams.team;
	let teamIds = new Array();
	teams.forEach((team: { status: string; matchSeries: { type: string }; id: string; uuid: string; seasonTeamId: string }) => {
		if (team.status == "ACTIVE") {
			if (leagueOnly && team.matchSeries.type == "League") {
				teamIds.push(team[idType]);
			} else if (!leagueOnly) {
				teamIds.push(team[idType]);
			}
		}
	});
	return teamIds;
}

export function cachedGetMatchSeriesId(teamId: string | number): string {
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

export function cachedGetUniqueMatchSeriesIds(teamIds?: (string | number)[]): string[] {
	// returns the match Series Ids without duplicates
	// if no teamId parameter is provided, the function fetches ids of league teams from the club file itself
	let UniqueMatchSeriesIds = new Array();
	if (!teamIds) {
		teamIds = cachedGetTeamIds("id");
	}
	teamIds.map((team) => {
		const matchSeriesId = cachedGetMatchSeriesId(team);
		if (!UniqueMatchSeriesIds.includes(matchSeriesId)) {
			UniqueMatchSeriesIds.push(matchSeriesId.toString());
		}
	});
	return UniqueMatchSeriesIds;
}

export function getLeagueName(teamId?: number): string | false {
	const clubdata = fs.readFileSync(CLUB_SAMS_FILE);
	const clubDataObject = JSON.parse(clubdata.toString());
	const teams = clubDataObject.sportsclub.teams.team;
	const filteredTeam = teams.filter((team: { id: number | undefined }) => team.id && teamId == team.id);
	if (filteredTeam.length == 0) {
		return false;
	}
	const leagueName = filteredTeam[0].matchSeries.name;
	return leagueName;
}
