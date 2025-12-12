/**
 * Lambda function for sharing news articles to Mastodon
 */

import type { News } from "@/lib/db/types";

const MASTODON_ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;
const MASTODON_INSTANCE = "https://freiburg.social";
const MASTODON_BASE_URL = `${MASTODON_INSTANCE}/api/v1`;

interface MastodonShareRequest {
	newsArticle: News;
	websiteUrl: string;
}

interface MastodonStatusResponse {
	id: string;
	url: string;
	created_at: string;
}

/**
 * Share a news article to Mastodon
 */
export async function shareToMastodon(request: MastodonShareRequest): Promise<MastodonStatusResponse> {
	if (!MASTODON_ACCESS_TOKEN) {
		throw new Error("MASTODON_ACCESS_TOKEN environment variable is not set");
	}

	const { newsArticle, websiteUrl } = request;

	// Build post content
	const articleUrl = `${websiteUrl}/news/${newsArticle.id}`;
	const status = buildMastodonStatus(newsArticle, articleUrl);

	console.log("📤 Sharing to Mastodon:", { title: newsArticle.title, url: articleUrl });

	// Post to Mastodon
	const response = await fetch(`${MASTODON_BASE_URL}/statuses`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${MASTODON_ACCESS_TOKEN}`,
		},
		body: JSON.stringify({
			status,
			visibility: "public",
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to post to Mastodon: ${response.status} ${response.statusText} - ${errorText}`);
	}

	const result = (await response.json()) as MastodonStatusResponse;
	console.log("✅ Successfully shared to Mastodon:", { id: result.id, url: result.url });

	return result;
}

/**
 * Build Mastodon status text from news article
 */
function buildMastodonStatus(newsArticle: News, articleUrl: string): string {
	const title = newsArticle.title;
	const excerpt = newsArticle.excerpt || "";

	// Mastodon has a 500 character limit
	// Format: Title + excerpt (if available) + URL
	let status = title;

	if (excerpt) {
		// Add excerpt if there's room (leaving space for URL and formatting)
		const urlLength = articleUrl.length + 4; // URL + "\n\n" + space
		const availableLength = 500 - title.length - urlLength;

		if (availableLength > 20 && excerpt.length <= availableLength) {
			status = `${title}\n\n${excerpt}`;
		} else if (availableLength > 20) {
			// Truncate excerpt if needed
			const truncatedExcerpt = `${excerpt.slice(0, availableLength - 3)}...`;
			status = `${title}\n\n${truncatedExcerpt}`;
		}
	}

	// Add URL at the end
	status = `${status}\n\n${articleUrl}`;

	return status;
}

/**
 * Lambda handler for direct invocation
 */
export async function handler(event: MastodonShareRequest): Promise<MastodonStatusResponse> {
	console.log("🚀 Mastodon sharing Lambda triggered", { event });

	try {
		const result = await shareToMastodon(event);
		return result;
	} catch (error) {
		console.error("❌ Error sharing to Mastodon:", error);
		throw error;
	}
}
