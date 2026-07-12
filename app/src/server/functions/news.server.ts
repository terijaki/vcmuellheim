/**
 * News server-only helpers — DynamoDB and S3 access.
 */

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { slugify } from "@utils/slugify";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { newsSchema } from "@/lib/db/schemas";
import { withTimestamps } from "../dynamo";
import { getAllNews, getPublishedNews } from "../queries";
import { parseServerData } from "../schema-parse";

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

  return news;
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
  return news;
}

export async function handleDeleteNews(id: string) {
  await db().news.delete({ id }).go();
  return { success: true as const };
}
