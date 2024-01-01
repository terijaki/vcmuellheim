import fs from "fs";

const CLUB_SAMS_FILE = "data/sams/club.json";

export function getTeamIds(idType: "id" | "uuid" | "seasonTeamId" = "id") {
	const clubdata = fs.readFileSync(CLUB_SAMS_FILE);
	const clubDataObject = JSON.parse(clubdata.toString());
	const teams = clubDataObject.sportsclub.teams.team;
	let teamIds = new Array();
	teams.forEach((team: { status: string; matchSeries: { type: string }; id: string; uuid: string; seasonTeamId: string }) => {
		if (team.status == "ACTIVE" && team.matchSeries.type == "League") {
			teamIds.push(team[idType]);
		}
	});
	return teamIds;
}

export function getMatchSeriesId(teamId: string): string {
	const clubdata = fs.readFileSync(CLUB_SAMS_FILE);
	const clubDataObject = JSON.parse(clubdata.toString());
	const teams = clubDataObject.sportsclub.teams.team;
	let result = "";
	teams.forEach((team: { matchSeries: any; id: string }) => {
		if (team.id == teamId) {
			result = team.matchSeries.id;
		}
	});
	return result;
}

export function getUniqueMatchSeriesIds(teamIds?: string[]) {
	// returns the match Series Ids without duplicates
	// if no teamId parameter is provided, the function fetches ids of league teams from the club file itself
	let UniqueMatchSeriesIds = new Array();
	if (!teamIds) {
		teamIds = getTeamIds("id");
	}
	teamIds.map((team) => {
		const matchSeriesId = getMatchSeriesId(team);
		if (!UniqueMatchSeriesIds.includes(matchSeriesId)) {
			UniqueMatchSeriesIds.push(matchSeriesId);
		}
	});
	return UniqueMatchSeriesIds;
}

export function getLeagueName(teamId?: number) {
	const clubdata = fs.readFileSync(CLUB_SAMS_FILE);
	const clubDataObject = JSON.parse(clubdata.toString());
	const teams = clubDataObject.sportsclub.teams.team;
	const filteredTeam = teams.filter((team: { id: number | undefined }) => team.id && teamId == team.id);
	const leagueName = filteredTeam[0].matchSeries.name;
	return leagueName;
}
