"use server";
import config from "@payload-config";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getPayload } from "payload";

const payload = await getPayload({ config });

export async function getPictures(limit = 100, page = 1) {
	"use cache";
	cacheLife("days");

	try {
		const pictures = await payload.find({
			collection: "media",
			depth: 1,
			page,
			where: {
				"news.images": { exists: true },
			},
			limit,
		});

		if (pictures) return pictures;
	} catch (error) {
		console.error("Error fetching pictures:", error);
	}
}

export async function getTeamPictures(slug: string, limit = 100) {
	"use cache";
	cacheLife("days");

	try {
		const pictures = await payload.find({
			collection: "media",
			depth: 1,
			where: {
				"teams.images": { exists: true },
			},
			limit,
		});

		if (pictures) return pictures;
	} catch (error) {
		console.error("Error fetching pictures:", error);
	}
}
