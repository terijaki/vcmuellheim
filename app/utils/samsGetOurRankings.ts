import { getUniqueMatchSeriesIds } from "@/app/utils/samsJsonGetUniqueMatchSeriesIds";
import getRankings from "@/app/utils/samsGetRankings";

export default function getOurRankings() {
	getUniqueMatchSeriesIds().map((matchSeriesId) => {
		getRankings(matchSeriesId);
	});
}
