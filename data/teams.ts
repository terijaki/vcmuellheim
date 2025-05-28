"use server";
import config from "@payload-config";
import { getPayload } from "payload";

const payload = await getPayload({ config });

export async function getTeams(slug?: string, league?: boolean) {
	try {
		const slugFilter = slug ? { slug: { equals: slug } } : null;
		const leagueFilter = league ? { "sbvvTeam.matchSeries_Type": { exists: true } } : null;

		const teams = await payload.find({
			collection: "teams",
			limit: 50,
			sort: "league",
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
