"use server";
import config from "@payload-config";
import { getPayload } from "payload";

const payload = await getPayload({ config });

export async function getNews(limit?: number, page?: number) {
	try {
		const news = await payload.find({
			collection: "news",
			limit: Math.min(limit || 50, 50),
			sort: "-publishedDate",
			page: page || 1,
			select: {
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
export async function getNewsItem(id: string, draft = false) {
	try {
		const newsItem = await payload.findByID({
			collection: "news",
			id: id,
			draft: draft,
			select: {
				title: true,
				content: true,
				publishedDate: true,
				images: true,
			},
		});
		console.log(newsItem);
		if (newsItem) return newsItem;
	} catch (error) {
		console.error(`Error fetching newsItem: ${id}`, error);
	}
}
