import fs from "fs";
import path from "path";

const SAMS_FOLDER = "data/sams";

export function cachedGetRankings(matchSeriesArray: string[]): rankingsArray[] {
	let resultArray = new Array();
	matchSeriesArray.map((matchSeriesId) => {
		const file = path.join(SAMS_FOLDER, "matchSeriesId", matchSeriesId) + "/rankings.json";
		if (fs.existsSync(file)) {
			const rankings = fs.readFileSync(file);
			const rankingsObject = JSON.parse(rankings.toString());
			const results = rankingsObject.rankings;
			resultArray.push(results);
		}
	});
	return resultArray;
}

export type rankingsArray = {
	matchSeries: {
		id: string;
		uuid: string;
		name: string;
		type: string;
		updated: string;
		season: { id: string; name: string };
		hierarchy: { id: string; name: string; hierarchyLevel: string };
	};
	ranking: [
		{
			team: { id: string; name: string; club: { name: string } };
			place: string;
			matchesPlayed: string;
			wins: string;
			losses: string;
			points: string;
			setPoints: string;
		}
	];
	exclusive?: string | number;
	linkToTeamPage?: boolean;
};
