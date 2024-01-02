import { getUniqueMatchSeriesIds } from "@/app/utils/samsJsonGetUniqueMatchSeriesIds";
import { getMatches } from "@/app/utils/samsGetMatches";

export function getOurMatches() {
	getUniqueMatchSeriesIds().map((matchSeriesId) => {
		getMatches(undefined, matchSeriesId);
	});
}

getOurMatches();
