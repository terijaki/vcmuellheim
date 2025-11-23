/**
 * tRPC router for SAMS Teams operations
 */

import { z } from "zod";
import { samsTeamSchema } from "../../db/schemas";
import { publicProcedure, router } from "../trpc";

const SAMS_API_URL = process.env.SAMS_API_URL || "";

export const samsTeamsRouter = router({
	/** Get all SAMS teams for our club */
	list: publicProcedure.query(async () => {
		const response = await fetch(`${SAMS_API_URL}/sams/teams`);
		if (!response.ok) {
			throw new Error("Failed to fetch SAMS teams");
		}
		const data = (await response.json()) as { teams: unknown[] };
		return z.array(samsTeamSchema).parse(data.teams || []);
	}),
});
