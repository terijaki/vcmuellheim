import fs from "fs";
import path from "path";
import { shuffleArray } from "./shuffleArray";

const TEAMS_FOLDER = "data/teams";

export type teamObject = {
	index?: number;
	title?: string;
	slug?: string;
	sorting?: number;
	liga?: boolean;
	sbvvId?: any;
	alter?: number;
	training?: [{ zeit?: string; ort?: string; map?: string }];
	trainer?: [{ name?: string; email?: string; avatar?: string }];
	ansprechperson?: [{ name?: string; email?: string }];
	kommentar?: string;
	kurztext?: string;
	pictures?: string[];
};

export function getTeams(sbvvId?: number, slug?: string): teamObject[] {
	const targetFolder = TEAMS_FOLDER;
	const teamFiles = fs.readdirSync(targetFolder);
	// read the data
	const teamsData = teamFiles.map((team) => {
		const teamContent = fs.readFileSync(path.join(targetFolder, team));
		const teamData = JSON.parse(teamContent.toString());
		// add slug based on file name
		teamData.slug = team.replace(".json", "");
		// randomize team picture order
		if (teamData.pictures && teamData.pictures.length > 1) {
			teamData.pictures = shuffleArray(teamData.pictures);
		}
		return teamData;
	});
	// sort results by sorting object-key
	const teamsSorted = teamsData.sort((a, b) => {
		if (!a.sorting) {
			a.sorting = "9999";
		}
		if (!b.sorting) {
			b.sorting = "9999";
		}
		return a.sorting - b.sorting;
	});
	// filter based on props
	const filterSbvvId = teamsSorted.filter((team) => !sbvvId || sbvvId == team.sbvvId);
	const filterSlug = filterSbvvId.filter((team) => !slug || slug == team.slug);

	return filterSlug;
}
