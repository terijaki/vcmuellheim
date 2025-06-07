"server-only";
import { payload } from "./payload-client";

export async function getNews(limit = 50, page = 1, draft = false) {
	try {
		const news = await payload.find({
			collection: "news",
			limit,
			sort: "-publishedDate",
			page,
			draft: draft,
			where: {
				isPublished: {
					equals: true, // Ensure we only fetch published news
				},
				publishedDate: {
					less_than_equal: new Date(), // Ensure publishing date is in the past or present
				},
			},
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
