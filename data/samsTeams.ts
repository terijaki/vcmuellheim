"use server";
import { SAMS } from "@/project.config";
import { payload } from "./payload-client";
import type { SamsTeam } from "./payload-types";

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

export async function getSamsTeamByName(name: string): Promise<SamsTeam | undefined> {
	try {
		const teams = await payload.find({
			collection: "sams-teams",
			limit: 1,
			where: {
				name: {
					equals: name,
				},
			},
		});
		if (teams && teams.docs.length > 0) return teams.docs[0];
	} catch (error) {
		console.error("Error fetching teams:", error);
	}
}

export async function getOurClubsSamsTeams(): Promise<SamsTeam[] | undefined> {
	try {
		const teams = await payload.find({
			collection: "sams-teams",
			limit: 100,
			where: {
				name: {
					contains: SAMS.name,
				},
			},
		});
		if (teams.docs) return teams.docs;
	} catch (error) {
		console.error("Error fetching teams:", error);
	}
}
