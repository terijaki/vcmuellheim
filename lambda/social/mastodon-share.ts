/**
 * Lambda function for sharing news articles to Mastodon
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { News } from "@/lib/db/types";

const MASTODON_ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;
const MASTODON_INSTANCE = "https://freiburg.social";
const MASTODON_BASE_URL = `${MASTODON_INSTANCE}/api/v1`;
const MEDIA_BUCKET_NAME = process.env.MEDIA_BUCKET_NAME || "";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });

interface MastodonShareRequest {
	newsArticle: News;
	websiteUrl: string;
}

interface MastodonStatusResponse {
	id: string;
	url: string;
	created_at: string;
}

interface MastodonMediaResponse {
	id: string;
	type: string;
	url: string;
}

/**
 * Upload image to Mastodon media API
 */
async function uploadMediaToMastodon(s3Key: string): Promise<string | null> {
	try {
		// Get image from S3
		const command = new GetObjectCommand({
			Bucket: MEDIA_BUCKET_NAME,
			Key: s3Key,
		});
		const s3Response = await s3Client.send(command);

		if (!s3Response.Body) {
			console.warn(`⚠️ No body in S3 response for key: ${s3Key}`);
			return null;
		}

		// Convert stream to buffer
		const chunks: Uint8Array[] = [];
		for await (const chunk of s3Response.Body as AsyncIterable<Uint8Array>) {
			chunks.push(chunk);
		}
		const buffer = Buffer.concat(chunks);

		// Create form data for Mastodon media upload
		const formData = new FormData();
		const blob = new Blob([buffer], { type: s3Response.ContentType || "image/jpeg" });
		formData.append("file", blob, s3Key.split("/").pop() || "image.jpg");

		// Upload to Mastodon
		const response = await fetch(`${MASTODON_BASE_URL}/media`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${MASTODON_ACCESS_TOKEN}`,
			},
			body: formData,
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.warn(`⚠️ Failed to upload media to Mastodon: ${response.status} - ${errorText}`);
			return null;
		}

		const result = (await response.json()) as MastodonMediaResponse;
		console.log(`✅ Uploaded media to Mastodon: ${result.id}`);
		return result.id;
	} catch (error) {
		console.error(`❌ Error uploading media to Mastodon:`, error);
		return null;
	}
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

	// Generate idempotency key based on article ID (stable across retries)
	const idempotencyKey = `news-${newsArticle.id}`;

	console.log("📤 Sharing to Mastodon:", { title: newsArticle.title, url: articleUrl, idempotencyKey });

	// Upload images to Mastodon (if any)
	const mediaIds: string[] = [];
	if (newsArticle.imageS3Keys && newsArticle.imageS3Keys.length > 0 && MEDIA_BUCKET_NAME) {
		// Mastodon allows up to 4 images per post
		const imagesToUpload = newsArticle.imageS3Keys.slice(0, 4);
		console.log(`📸 Uploading ${imagesToUpload.length} image(s) to Mastodon`);

		for (const s3Key of imagesToUpload) {
			const mediaId = await uploadMediaToMastodon(s3Key);
			if (mediaId) {
				mediaIds.push(mediaId);
			}
		}

		console.log(`✅ Uploaded ${mediaIds.length}/${imagesToUpload.length} images successfully`);
	}

	// Post to Mastodon
	const response = await fetch(`${MASTODON_BASE_URL}/statuses`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${MASTODON_ACCESS_TOKEN}`,
			"Idempotency-Key": idempotencyKey,
		},
		body: JSON.stringify({
			status,
			visibility: "public",
			language: "de",
			...(mediaIds.length > 0 ? { media_ids: mediaIds } : {}),
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
