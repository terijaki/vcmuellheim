/**
 * tRPC router for SAMS Clubs operations
 */

import z from "zod";
import { getAllSamsClubs, getSamsClubByNameSlug, getSamsClubBySportsclubUuid } from "@/lib/db";
import { publicProcedure, router } from "../trpc";

export const samsClubsRouter = router({
	/** Get all SAMS Clubs */
	list: publicProcedure.query(async () => {
		return getAllSamsClubs();
	}),
	/** Get SAMS Club by sportsclub UUID */
	getById: publicProcedure.input(z.object({ sportsclubUuid: z.string() })).query(async ({ input }) => {
		return getSamsClubBySportsclubUuid(input.sportsclubUuid);
	}),
	/** Get SAMS Club by nameSlug */
	getByNameSlug: publicProcedure.input(z.object({ nameSlug: z.string() })).query(async ({ input }) => {
		return getSamsClubByNameSlug(input.nameSlug);
	}),
});
