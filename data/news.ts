"server-only";
import { payload } from "./payload-client";

export async function getNews(limit = 50, page = 1) {
	try {
		const news = await payload.find({
			collection: "news",
			limit,
			sort: "-publishedDate",
			page,
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
		if (newsItem) return newsItem;
	} catch (error) {
		console.error(`Error fetching newsItem: ${id}`, error);
	}
}
