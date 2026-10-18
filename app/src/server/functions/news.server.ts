/**
 * News server-only helpers — DynamoDB and S3 access.
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { slugify } from "@utils/slugify";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { newsSchema } from "@/lib/db/schemas";
import { readLatestNews, rebuildLatestNews } from "@/lib/read-models/public-snapshots";
import { withTimestamps } from "../dynamo";
import { getAllNews, getPublishedNews } from "../queries";
import { parseServerArray, parseServerData } from "../schema-parse";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
const BUCKET_NAME = () => process.env.MEDIA_BUCKET_NAME || "";
const MEDIA_CLOUDFRONT_URL = () => process.env.MEDIA_CLOUDFRONT_URL || "";

const newsInputSchema = newsSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  type: true,
  slug: true,
});

type NewsInput = z.infer<typeof newsInputSchema>;

export async function handleGetHomeNews() {
  const snapshot = await readLatestNews();
  return { items: snapshot?.items ?? [] };
}

export async function handleGetPublishedNews(data?: { limit?: number; cursor?: string }) {
  return getPublishedNews(data?.limit, data?.cursor);
}

export async function handleGetNewsById(id: string) {
  const result = await db().news.get({ id }).go();
  return result.data
    ? parseServerData(newsSchema, result.data, "Failed to parse news article")
    : null;
}

export async function handleGetGalleryImages(data?: {
  limit?: number;
  format?: "urls" | "keys";
  cursor?: string;
  shuffle?: boolean;
}) {
  const { items, lastEvaluatedKey } = await getPublishedNews(data?.limit ?? 20, data?.cursor);

  const imageKeys: string[] = items.flatMap((article) => article.imageS3Keys ?? []).filter(Boolean);

  const shuffled = data?.shuffle ? [...imageKeys].sort(() => Math.random() - 0.5) : imageKeys;

  if (data?.format === "keys") {
    return { images: shuffled, nextCursor: lastEvaluatedKey };
  }

  const cloudfrontUrl = MEDIA_CLOUDFRONT_URL();
  const urls = await Promise.all(
    shuffled.map(async (key) => {
      if (cloudfrontUrl) return `${cloudfrontUrl}/${key}`;
      const cmd = new GetObjectCommand({ Bucket: BUCKET_NAME(), Key: key });
      return getSignedUrl(s3Client, cmd, { expiresIn: 3600 });
    }),
  );

  return { images: urls, nextCursor: lastEvaluatedKey };
}

export async function handleListAllNews(data?: { limit?: number; lastEvaluatedKey?: string }) {
  return getAllNews(data?.limit, data?.lastEvaluatedKey);
}

export async function handleCreateNews(data: NewsInput) {
  const id = crypto.randomUUID();
  const slug = slugify(data.title);
  const news = withTimestamps({ ...data, id, slug, type: "article" as const });

  await db().news.create(news).go();
  await rebuildLatestNews();

  return news;
}

/** Programmatic create. Always stores the article as a draft. */
export async function handleCreateDraftNews(data: NewsInput) {
  return handleCreateNews({
    title: data.title,
    content: data.content,
    excerpt: data.excerpt,
    imageS3Keys: data.imageS3Keys,
    tags: data.tags,
    status: "draft",
  });
}

/**
 * Move a draft or archived article to published.
 * An article that is already published is returned unchanged, with no write.
 */
export async function handlePublishNews(id: string) {
  const existing = await handleGetNewsById(id);
  if (!existing) return null;
  if (existing.status === "published") return existing;
  return handleUpdateNews(id, { status: "published" });
}

/** Programmatic update. Status cannot be changed here; use publish for that. */
export async function handleUpdateNewsContent(
  id: string,
  updates: Partial<Pick<NewsInput, "title" | "content" | "excerpt" | "imageS3Keys" | "tags">>,
) {
  const existing = await handleGetNewsById(id);
  if (!existing) return null;
  if (Object.keys(updates).length === 0) return existing;
  return handleUpdateNews(id, updates);
}

export async function handleListAdminNews(data?: {
  limit?: number;
  cursor?: string;
  status?: NewsInput["status"];
}) {
  const limit = data?.limit ?? 30;
  if (data?.status) {
    const result = await db()
      .news.query.byStatus({ status: data.status })
      .gt({ createdAt: "2000-01-01T00:00:00.000Z" })
      .go({ order: "desc", limit, cursor: data.cursor });
    return {
      items: parseServerArray(newsSchema, result.data, "Failed to parse news list"),
      nextCursor: result.cursor ?? undefined,
    };
  }

  const listed = await getAllNews(limit, data?.cursor);
  return { items: listed.items, nextCursor: listed.lastEvaluatedKey };
}

export async function handleUpdateNews(id: string, updates: Partial<NewsInput>) {
  const baseUpdates = {
    ...updates,
    type: "article" as const,
    updatedAt: new Date().toISOString(),
  };
  const finalUpdates = updates.title
    ? { ...baseUpdates, slug: slugify(updates.title) }
    : baseUpdates;

  const result = await db().news.patch({ id }).set(finalUpdates).go();
  if (!result.data) throw new Error("News article not found");

  const refreshedResult = await db().news.get({ id }).go();
  const news = refreshedResult.data
    ? parseServerData(newsSchema, refreshedResult.data, "Failed to parse news article")
    : null;
  if (!news) throw new Error("News article not found");
  await rebuildLatestNews();
  return news;
}

export async function handleDeleteNews(id: string) {
  await db().news.delete({ id }).go();
  await rebuildLatestNews();
  return { success: true as const };
}
