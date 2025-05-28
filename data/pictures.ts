"use server";
import config from "@payload-config";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getPayload } from "payload";

const payload = await getPayload({ config });

export async function getPictures(limit?: number) {
	"use cache";
	cacheLife("days");

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

export async function getTeamPictures(slug: string, limit?: number) {
	"use cache";
	cacheLife("days");

	try {
		const pictures = await payload.find({
			collection: "media",
			depth: 1,
			where: {
				"teams.images": { exists: true },
			},
			limit: Math.min(limit || 100, 100),
		});

		if (pictures) return pictures;
	} catch (error) {
		console.error("Error fetching pictures:", error);
	}
}
