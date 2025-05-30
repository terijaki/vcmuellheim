import { getNews } from "@/data/news";
import { Club } from "@/project.config";
import { Feed } from "feed";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ ext: "json" | "xml" | "atom" }> }) {
	try {
		// Get base URL from the request
		const origin = request.headers.get("host") || "localhost";
		const protocol = request.headers.get("x-forwarded-proto") || "https";
		const baseUrl = `${protocol}://${origin}`;

		const feed = new Feed({
			title: Club.name,
			description: "Neuigkeiten aus dem Verein",
			id: baseUrl,
			link: baseUrl,
			language: "de",
			image: `${baseUrl}/images/logo/variant2.png`,
			favicon: `${baseUrl}/images/icons/favicon.ico`,
			copyright: `Volleyballclub Müllheim e.V. ${new Date().getFullYear()}`,
			generator: "jpmonette/feed",
			feedLinks: {
				json: `${baseUrl}/rss.json`,
				atom: `${baseUrl}/atom`,
			},
			author: {
				name: Club.shortName,
				email: Club.email,
			},
		});
		feed.addCategory("Sports");
		feed.addContributor({
			name: Club.shortName,
			email: Club.email,
		});

		const newsData = await getNews(100);

		if (newsData?.docs) {
			for (const newsItem of newsData.docs) {
				let thumbnail: undefined | string;
				if (newsItem.images && newsItem.images.length > 0) {
					const firstImage = newsItem.images[0];
					if (typeof firstImage === "string") {
						thumbnail = `${baseUrl}${firstImage}`;
					} else {
						thumbnail = `${baseUrl}${firstImage.url}`;
					}
				}

				if (!newsItem.excerpt) continue;

				feed.addItem({
					title: newsItem.title,
					id: newsItem.id,
					link: `${baseUrl}/news/${newsItem.id}`,
					content: newsItem.excerpt,
					date: new Date(newsItem.publishedDate),
					image: thumbnail,
				});
			}
		}

		// Determine the format to return based on the params
		const { ext } = await params;

		if (ext === "json") {
			// Return JSON feed
			return new NextResponse(feed.json1(), {
				headers: {
					"Content-Type": "application/json",
				},
			});
		}
		if (ext === "atom") {
			// Return Atom feed
			return new NextResponse(feed.atom1(), {
				headers: {
					"Content-Type": "application/atom+xml",
				},
			});
		}

		// Default to RSS XML
		return new NextResponse(feed.rss2(), {
			headers: {
				"Content-Type": "application/xml",
			},
		});
	} catch (error) {
		console.error("Error generating RSS feed:", error);
		return new NextResponse("Error generating RSS feed", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
			},
		});
	}
}
