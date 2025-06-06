"use server";
import { payload } from "./payload-client";

export async function getTeams(slug?: string, league?: boolean, draft = false) {
	try {
		const slugFilter = slug ? { slug: { equals: slug } } : null;
		const leagueFilter = league ? { "sbvvTeam.leagueUuid": { exists: true } } : null;

		const teams = await payload.find({
			collection: "teams",
			limit: 50,
			sort: ["league", "name"],
			draft,
			where: {
				...slugFilter,
				...leagueFilter,
			},
		});

		if (teams) return teams;
	} catch (error) {
		console.error("Error fetching teams:", error);
	}
}
