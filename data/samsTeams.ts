"use server";
import config from "@payload-config";
import { getPayload } from "payload";
import type { SamsTeam } from "./payload-types";

const payload = await getPayload({ config });

export async function getSamsTeamBySamsUuid(uuid: string): Promise<SamsTeam | undefined> {
	try {
		const teams = await payload.find({
			collection: "sams-teams",
			limit: 1,
			where: {
				uuid: {
					equals: uuid,
				},
			},
		});
		if (teams && teams.docs.length > 0) return teams.docs[0];
	} catch (error) {
		console.error("Error fetching teams:", error);
	}
}
