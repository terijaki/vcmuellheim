/**
 * tRPC router for SAMS Teams operations
 */

import type { TeamResponse } from "@lambda/sams/types";
import { TeamsResponseSchema } from "@lambda/sams/types";
import { publicProcedure, router } from "../trpc";

const SAMS_API_URL = process.env.SAMS_API_URL || "";

export const samsTeamsRouter = router({
	/** Get all SAMS teams for our club */
	list: publicProcedure.query(async (): Promise<TeamResponse[]> => {
		const response = await fetch(`${SAMS_API_URL}/sams/teams`);
		if (!response.ok) {
			throw new Error("Failed to fetch SAMS teams");
		}
		const data = TeamsResponseSchema.parse(await response.json());
		return data.teams;
	}),
});
