/**
 * Lambda function for sharing news articles to Mastodon
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { News } from "@/lib/db/types";
import { parseLambdaEnv } from "../utils/env";
import { createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { MastodonShareLambdaEnvironmentSchema } from "./types";

const { logger } = createLambdaResources("mastodon-share");

const env = parseLambdaEnv(MastodonShareLambdaEnvironmentSchema);

const MASTODON_ACCESS_TOKEN = env.MASTODON_ACCESS_TOKEN;
const MASTODON_INSTANCE = "https://freiburg.social";
const MASTODON_BASE_URL = `${MASTODON_INSTANCE}/api/v1`;
const MEDIA_BUCKET_NAME = env.MEDIA_BUCKET_NAME;
const MASTODON_CHAR_LIMIT = 2500;

const s3Client = new S3Client({});

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
 * Upload image to Mastodon media API v2
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
			logger.warn("No body in S3 response", { s3Key });
			return null;
		}

		// Convert stream to buffer
		const chunks: Uint8Array[] = [];
		for await (const chunk of s3Response.Body as AsyncIterable<Uint8Array>) {
			chunks.push(chunk);
		}
		const buffer = Buffer.concat(chunks);

		// Create form data for Mastodon media upload (v2 API)
		const formData = new FormData();
		const blob = new Blob([buffer], { type: s3Response.ContentType || "image/jpeg" });
		formData.append("file", blob, s3Key.split("/").pop() || "image.jpg");

		// Upload to Mastodon using v2 API
		const response = await fetch(`https://freiburg.social/api/v2/media`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${MASTODON_ACCESS_TOKEN}`,
			},
			body: formData,
		});

		if (!response.ok) {
			const errorText = await response.text();
			logger.warn("Failed to upload media to Mastodon", { status: response.status, errorText });
			return null;
		}

		const result = (await response.json()) as MastodonMediaResponse;
		logger.info("Uploaded media to Mastodon", { mediaId: result.id });
		return result.id;
	} catch (error) {
		logger.error("Error uploading media to Mastodon", { error });
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

	logger.info("Sharing to Mastodon", { title: newsArticle.title, url: articleUrl, idempotencyKey });

	// Upload images to Mastodon (if any)
	const mediaIds: string[] = [];
	if (newsArticle.imageS3Keys && newsArticle.imageS3Keys.length > 0 && MEDIA_BUCKET_NAME) {
		// Mastodon allows up to 4 images per post
		const imagesToUpload = newsArticle.imageS3Keys.slice(0, 4);
		logger.info("Uploading images to Mastodon", { count: imagesToUpload.length });

		for (const s3Key of imagesToUpload) {
			const mediaId = await uploadMediaToMastodon(s3Key);
			if (mediaId) {
				mediaIds.push(mediaId);
			}
		}

		logger.info("Images uploaded", { uploaded: mediaIds.length, total: imagesToUpload.length });
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
			visibility: "unlisted",
			language: "de",
			...(mediaIds.length > 0 ? { media_ids: mediaIds } : {}),
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to post to Mastodon: ${response.status} ${response.statusText} - ${errorText}`);
	}

	const result = (await response.json()) as MastodonStatusResponse;
	logger.info("Successfully shared to Mastodon", { id: result.id, url: result.url });

	return result;
}

/**
 * Strip HTML tags from content, converting block elements to newlines and
 * decoding common HTML entities, to produce clean plain text.
 */
function stripHtml(html: string): string {
	// Convert closing block-level elements to newlines to preserve paragraph structure
	let text = html.replace(/<\/(p|h[1-6]|div|blockquote|li)>/gi, "\n");
	// Convert self-closing and opening block elements to newlines
	text = text.replace(/<(br|hr)(\/?\s*)>/gi, "\n");
	// Strip all remaining HTML tags
	text = text.replace(/<[^>]+>/g, "");
	// Decode common HTML entities in a single pass to avoid double-unescaping
	const entityMap: Record<string, string> = {
		amp: "&",
		lt: "<",
		gt: ">",
		nbsp: " ",
		quot: '"',
		"#x27": "'",
	};
	text = text.replace(/&(amp|lt|gt|nbsp|quot|#x27);/g, (_, entity: string) => {
		return entityMap[entity] ?? `&${entity};`;
	});
	// Collapse runs of 3 or more consecutive newlines to 2
	text = text.replace(/\n{3,}/g, "\n\n");
	return text.trim();
}

/**
 * Build Mastodon status text from news article
 */
function buildMastodonStatus(newsArticle: News, articleUrl: string): string {
	const title = newsArticle.title;
	const plainContent = stripHtml(newsArticle.content);

	// Try sharing the full article when it fits within the character limit
	const fullPost = `${title}\n\n${plainContent}`;
	if (fullPost.length <= MASTODON_CHAR_LIMIT) {
		return fullPost;
	}

	// Fall back to excerpt (or truncated content) + URL
	const excerpt = newsArticle.excerpt;
	// overhead: title + "\n\n" + "\n\n" + url
	const overhead = title.length + 4 + articleUrl.length;
	const available = MASTODON_CHAR_LIMIT - overhead;

	const textToFit = excerpt ?? plainContent;

	if (textToFit.length <= available) {
		// Text fits within the available space
		return `${title}\n\n${textToFit}\n\n${articleUrl}`;
	}

	// Need at least 20 available chars to produce a meaningful truncated snippet
	if (available > 20) {
		return `${title}\n\n${textToFit.slice(0, available - 1)}…\n\n${articleUrl}`;
	}

	return `${title}\n\n${articleUrl}`;
}

/**
 * Lambda handler for direct invocation
 */
async function lambdaHandler(event: MastodonShareRequest): Promise<MastodonStatusResponse> {
	logger.info("Mastodon sharing Lambda triggered", { event });

	try {
		const result = await shareToMastodon(event);
		return result;
	} catch (error) {
		logger.error("Error sharing to Mastodon", { error });
		throw error;
	}
}

export const handler = Sentry.wrapHandler(lambdaHandler);
