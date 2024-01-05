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
	// console.log(teamIds);
	return teamIds;
}

getTeamIds();
