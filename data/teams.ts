"use server";
import config from "@payload-config";
import { getPayload } from "payload";

export async function getTeams(withImages = false) {
	const payload = await getPayload({ config });

	try {
		const teams = await payload.find({
			collection: "teams",
			limit: 100,
			sort: "league",
		});

		if (teams) return teams;
	} catch (error) {
		console.error("Error fetching teams:", error);
	}
}
