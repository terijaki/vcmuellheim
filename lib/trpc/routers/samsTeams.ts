import { getAllSamsTeams } from "@/lib/db";
import { publicProcedure, router } from "../trpc";

export const samsTeamsRouter = router({
	/** Get all SAMS Teams */
	list: publicProcedure.query(async () => {
		return getAllSamsTeams();
	}),
});
