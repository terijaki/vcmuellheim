"use server";
import config from "@payload-config";
import { getPayload } from "payload";

export async function getPictures(limit?: number) {
	const payload = await getPayload({ config });

	try {
		const pictures = await payload.find({
			collection: "media",
			depth: 1,
			where: {
				"news.images": { exists: true },
			},
			limit: Math.min(limit || 100, 100),
		});

		if (pictures) return pictures;
	} catch (error) {
		console.error("Error fetching pictures:", error);
	}
}
