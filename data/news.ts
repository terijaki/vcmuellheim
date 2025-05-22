"use server";
import config from "@payload-config";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { getPayload } from "payload";

export async function getNews(limit?: number, page?: number) {
	const payload = await getPayload({ config });

	try {
		const news = await payload.find({
			collection: "news",
			limit: Math.min(limit || 50, 50),
			sort: "publishedDate",
			page: page || 1,
			select: {
				id: true,
				title: true,
				excerpt: true,
				publishedDate: true,
				images: true,
			},
		});

		if (news) return news;
	} catch (error) {
		console.error("Error fetching news:", error);
	}
}
export async function getNewsItem(id: string) {
	"use cache";
	cacheLife("days");

	const payload = await getPayload({ config });

	try {
		const newsItem = await payload.findByID({
			collection: "news",
			id: id,
			select: {
				title: true,
				content: true,
				publishedDate: true,
				images: true,
			},
		});

		if (newsItem) return newsItem;
	} catch (error) {
		console.error(`Error fetching newsItem: ${id}`, error);
	}
}
