"use server";
import { payload } from "./payload-client";
import type { SamsClub } from "./payload-types";

export async function getSamsClubBySamsUuid(uuid: string): Promise<SamsClub | undefined> {
	try {
		const clubs = await payload.find({
			collection: "sams-clubs",
			limit: 1,
			where: {
				uuid: {
					equals: uuid,
				},
			},
		});
		if (clubs && clubs.docs.length > 0) return clubs.docs[0];
	} catch (error) {
		console.error("Error fetching clubs:", error);
	}
}

export async function getSamsClubByName(name: string): Promise<SamsClub | undefined> {
	try {
		const clubs = await payload.find({
			collection: "sams-clubs",
			limit: 1,
			where: {
				name: {
					contains: name,
				},
			},
		});
		if (clubs && clubs.docs.length > 0) return clubs.docs[0];
	} catch (error) {
		console.error("Error fetching clubs:", error);
	}
}
