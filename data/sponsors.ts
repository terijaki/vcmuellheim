"use server";
import config from "@payload-config";
import { getPayload } from "payload";

const payload = await getPayload({ config });

export async function getSponsors() {
	try {
		const sponsors = await payload.find({
			collection: "sponsors",
			limit: 100,
			sort: "-name",
			where: {
				expiryDate: {
					greater_than_equal: new Date().toISOString(),
				},
			},
		});

		if (sponsors) return sponsors;
	} catch (error) {
		console.error("Error fetching sponsors:", error);
	}
}
