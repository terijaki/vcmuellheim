"use server";
import config from "@payload-config";
import { getPayload } from "payload";

export async function getMembers() {
	const payload = await getPayload({ config });

	try {
		const members = await payload.find({
			collection: "members",
			limit: 100,
			sort: "-name",
		});

		if (members) return members;
	} catch (error) {
		console.error("Error fetching members:", error);
	}
}
