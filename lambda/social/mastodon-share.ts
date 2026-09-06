/**
 * Lambda function for sharing news articles and match results to Mastodon
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Match } from "sams-provider-events";
import type { News } from "@/lib/db/types";
import { createMatchMastodonShareRepository } from "@/lib/social/match-mastodon-share";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { parseLambdaEnv } from "../utils/env";
import { Sentry } from "../utils/sentry";
import { buildMatchResultStatus } from "./match-result-status";
import { MastodonShareLambdaEnvironmentSchema } from "./types";

const { logger, tracer } = createLambdaResources("mastodon-share");

const env = parseLambdaEnv(MastodonShareLambdaEnvironmentSchema);

const MASTODON_ACCESS_TOKEN = env.MASTODON_ACCESS_TOKEN;
const MASTODON_INSTANCE = "https://freiburg.social";
const MASTODON_BASE_URL = `${MASTODON_INSTANCE}/api/v1`;
const MEDIA_BUCKET_NAME = env.MEDIA_BUCKET_NAME;
const SOCIAL_TABLE_NAME = env.SOCIAL_TABLE_NAME;
const MASTODON_CHAR_LIMIT = 2500;

const s3Client = new S3Client({});
const docClient = createDynamoDocClient(tracer);

export interface MastodonNewsShareRequest {
  newsArticle: News;
  websiteUrl: string;
}

export interface MastodonMatchShareRequest {
  match: Match;
  configuredSportsclubUuids: string[];
}

export type MastodonShareRequest = MastodonNewsShareRequest | MastodonMatchShareRequest;

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

export function isNewsShareRequest(
  request: MastodonShareRequest,
): request is MastodonNewsShareRequest {
  return "newsArticle" in request && "websiteUrl" in request;
}

export function isMatchShareRequest(
  request: MastodonShareRequest,
): request is MastodonMatchShareRequest {
  return "match" in request && "configuredSportsclubUuids" in request;
}

/**
 * Post a status to Mastodon with a stable idempotency key.
 */
export async function postMastodonStatus(options: {
  status: string;
  idempotencyKey: string;
  mediaIds?: string[];
  accessToken?: string;
}): Promise<MastodonStatusResponse> {
  const accessToken = options.accessToken ?? MASTODON_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MASTODON_ACCESS_TOKEN environment variable is not set");
  }

  const response = await fetch(`${MASTODON_BASE_URL}/statuses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Idempotency-Key": options.idempotencyKey,
    },
    body: JSON.stringify({
      status: options.status,
      visibility: "unlisted",
      language: "de",
      ...(options.mediaIds && options.mediaIds.length > 0 ? { media_ids: options.mediaIds } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to post to Mastodon: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  return (await response.json()) as MastodonStatusResponse;
}

/**
 * Upload image to Mastodon media API v2
 */
async function uploadMediaToMastodon(s3Key: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: MEDIA_BUCKET_NAME,
      Key: s3Key,
    });
    const s3Response = await s3Client.send(command);

    if (!s3Response.Body) {
      logger.warn("No body in S3 response", { s3Key });
      return null;
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of s3Response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const formData = new FormData();
    const blob = new Blob([buffer], { type: s3Response.ContentType || "image/jpeg" });
    formData.append("file", blob, s3Key.split("/").pop() || "image.jpg");

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
export async function shareToMastodon(
  request: MastodonNewsShareRequest,
): Promise<MastodonStatusResponse> {
  if (!MASTODON_ACCESS_TOKEN) {
    throw new Error("MASTODON_ACCESS_TOKEN environment variable is not set");
  }

  const { newsArticle, websiteUrl } = request;

  const articleUrl = `${websiteUrl}/news/${newsArticle.id}`;
  const status = buildMastodonStatus(newsArticle, articleUrl);
  const idempotencyKey = `news-${newsArticle.id}`;

  logger.info("Sharing to Mastodon", { title: newsArticle.title, url: articleUrl, idempotencyKey });

  const mediaIds: string[] = [];
  if (newsArticle.imageS3Keys && newsArticle.imageS3Keys.length > 0 && MEDIA_BUCKET_NAME) {
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

  const result = await postMastodonStatus({
    status,
    idempotencyKey,
    mediaIds,
  });
  logger.info("Successfully shared to Mastodon", { id: result.id, url: result.url });
  return result;
}

/**
 * Share a concluded match result to Mastodon and mark the ledger posted.
 */
export async function shareMatchToMastodon(
  request: MastodonMatchShareRequest,
): Promise<MastodonStatusResponse> {
  if ((env.CDK_ENVIRONMENT ?? "") !== "prod") {
    throw new Error("Match Mastodon sharing is only allowed in production");
  }
  if (!MASTODON_ACCESS_TOKEN) {
    throw new Error("MASTODON_ACCESS_TOKEN environment variable is not set");
  }
  if (!SOCIAL_TABLE_NAME) {
    throw new Error("SOCIAL_TABLE_NAME environment variable is not set");
  }

  const status = buildMatchResultStatus(request.match, request.configuredSportsclubUuids);
  if (!status) {
    throw new Error(`Unable to build Mastodon status for match ${request.match.uuid}`);
  }

  const idempotencyKey = `match-${request.match.uuid}`;
  logger.info("Sharing match result to Mastodon", {
    matchUuid: request.match.uuid,
    idempotencyKey,
  });

  const result = await postMastodonStatus({ status, idempotencyKey });

  const shareRepo = createMatchMastodonShareRepository(docClient, SOCIAL_TABLE_NAME);
  await shareRepo.markPosted(request.match.uuid, result.id);

  logger.info("Successfully shared match to Mastodon", {
    matchUuid: request.match.uuid,
    id: result.id,
    url: result.url,
  });
  return result;
}

/**
 * Strip HTML tags from content, converting block elements to newlines and
 * decoding common HTML entities, to produce clean plain text.
 */
function stripHtml(html: string): string {
  // Convert closing block-level elements to newlines to preserve paragraph structure
  let text = html.replace(/<\/(p|h[1-6]|div|blockquote|li)>/gi, "\n");
  // Convert opening/self-closing line-break elements to newlines, handling attributes and all spacing variants
  text = text.replace(/<(br|hr)\b[^>]*>/gi, "\n");
  // Strip all remaining complete HTML tags; repeat until stable to avoid
  // incomplete multi-character sanitization where new matches appear after replacement
  let previous: string;
  do {
    previous = text;
    text = text.replace(/<[^>]+>/g, "");
  } while (text !== previous);
  // Remove any remaining angle brackets (handles unclosed tags such as `<script` without closing `>`)
  text = text.replace(/[<>]/g, "");
  // Decode safe HTML entities in a single pass; intentionally excludes &lt;/&gt; to avoid
  // reintroducing angle brackets after the sanitization steps above
  const entityMap: Record<string, string> = {
    amp: "&",
    nbsp: " ",
    quot: '"',
    "#x27": "'",
  };
  text = text.replace(/&(amp|nbsp|quot|#x27);/g, (_, entity: string) => {
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
  // Use Array.from for Unicode-safe code-point counting (avoids splitting surrogate pairs)
  const fullPost = `${title}\n\n${plainContent}`;
  if (Array.from(fullPost).length <= MASTODON_CHAR_LIMIT) {
    return fullPost;
  }

  // Fall back to excerpt (or truncated content) + URL
  const excerpt = newsArticle.excerpt;
  // overhead: title + "\n\n" + "\n\n" + url (code-point counts)
  const overhead = Array.from(title).length + 4 + Array.from(articleUrl).length;
  const available = MASTODON_CHAR_LIMIT - overhead;

  const textToFit = excerpt ?? plainContent;
  const textToFitCodePoints = Array.from(textToFit);

  if (textToFitCodePoints.length <= available) {
    // Text fits within the available space
    return `${title}\n\n${textToFit}\n\n${articleUrl}`;
  }

  // Need at least 20 available chars to produce a meaningful truncated snippet
  if (available > 20) {
    return `${title}\n\n${textToFitCodePoints.slice(0, available - 1).join("")}…\n\n${articleUrl}`;
  }

  return `${title}\n\n${articleUrl}`;
}

/**
 * Lambda handler for direct invocation
 */
async function lambdaHandler(event: MastodonShareRequest): Promise<MastodonStatusResponse> {
  logger.info("Mastodon sharing Lambda triggered", { event });

  try {
    if (isMatchShareRequest(event)) {
      return await shareMatchToMastodon(event);
    }
    if (isNewsShareRequest(event)) {
      return await shareToMastodon(event);
    }
    throw new Error("Unrecognized Mastodon share payload");
  } catch (error) {
    logger.error("Error sharing to Mastodon", { error });
    throw error;
  }
}

export const handler = Sentry.wrapHandler(lambdaHandler);
