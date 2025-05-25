"use server";
import config from "@payload-config";
import { getPayload } from "payload";

export async function getTeams(withImages = false, slug?: string) {
	const payload = await getPayload({ config });

	try {
		const teams = await payload.find({
			collection: "teams",
			limit: 50,
			sort: "league",
			where: slug
				? {
						slug: {
							equals: slug, // filter by id if provided
						},
					}
				: undefined,
		});

		if (teams) return teams;
	} catch (error) {
		console.error("Error fetching teams:", error);
	}
}
