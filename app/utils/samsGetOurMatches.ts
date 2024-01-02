import { getUniqueMatchSeriesIds } from "@/app/utils/samsJsonClubData";
import getMatches from "@/app/utils/samsGetMatches";

export default function getOurMatches() {
	getUniqueMatchSeriesIds().map((matchSeriesId) => {
		getMatches(undefined, matchSeriesId);
	});
}
