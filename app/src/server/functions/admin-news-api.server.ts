/**
 * HTTP adapter for programmatic news management.
 * Callers authenticate with a CMS API key scoped to news.
 */

import { newsSchema } from "@/lib/db/schemas";
import { z } from "zod";
import {
  isCmsNewsImageContentType,
  toAdminNewsArticleResponse,
  validateNewsGalleryS3Keys,
} from "../admin-news-images";
import { authenticateApiKey } from "../api-keys.server";
import { buildAdminCmsOpenApiDocument } from "../openapi/admin-cms-openapi";
import { resolveNewsPublicOrigin } from "../news-public-url";
import {
  handleCreateDraftNews,
  handleGetNewsById,
  handleListAdminNews,
  handlePublishNews,
  handleUpdateNewsContent,
} from "./news.server";
import { handleGetPresignedUrl, handleProcessMediaImage } from "./upload.server";

const PRESIGNED_UPLOAD_EXPIRES_SECONDS = 300;

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
} as const;

const PUBLIC_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
} as const;

const newsContentFieldsSchema = newsSchema.pick({
  title: true,
  content: true,
  excerpt: true,
  imageS3Keys: true,
  tags: true,
});

const createNewsBodySchema = newsContentFieldsSchema.extend({
  status: z.enum(["draft", "published", "archived"]).optional(),
});

const updateNewsBodySchema = newsContentFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "At least one field is required" });

const mediaUploadUrlBodySchema = z.object({
  filename: z.string().trim().min(1, "filename is required"),
  contentType: z
    .string()
    .min(1)
    .refine(isCmsNewsImageContentType, { message: "Unsupported content type" }),
});

const mediaProcessBodySchema = z.object({
  s3Key: z.string().min(1),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function jsonNews(
  request: Request,
  article: Parameters<typeof toAdminNewsArticleResponse>[1],
  status = 200,
) {
  const origin = resolveNewsPublicOrigin(request);
  const body = await toAdminNewsArticleResponse(origin, article);
  return json(body, status);
}

async function jsonNewsList(
  request: Request,
  result: { items: Parameters<typeof toAdminNewsArticleResponse>[1][]; nextCursor?: string },
) {
  const origin = resolveNewsPublicOrigin(request);
  const items = await Promise.all(
    result.items.map((article) => toAdminNewsArticleResponse(origin, article)),
  );
  return json({
    items,
    ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

function newsId(value: string): string | null {
  return z.uuid().safeParse(value).success ? value : null;
}

function readListQuery(url: URL):
  | {
      ok: true;
      limit?: number;
      cursor?: string;
      status?: "draft" | "published" | "archived";
    }
  | { ok: false; message: string } {
  const limitRaw = url.searchParams.get("limit");
  let limit: number | undefined;
  if (limitRaw !== null && limitRaw !== "") {
    if (!/^\d+$/.test(limitRaw)) return { ok: false, message: "Invalid limit" };
    limit = Number(limitRaw);
    if (limit < 1 || limit > 100) return { ok: false, message: "Invalid limit" };
  }

  const statusRaw = url.searchParams.get("status");
  if (
    statusRaw !== null &&
    statusRaw !== "draft" &&
    statusRaw !== "published" &&
    statusRaw !== "archived"
  ) {
    return { ok: false, message: "Invalid status" };
  }

  const cursor = url.searchParams.get("cursor");
  return {
    ok: true,
    limit,
    cursor: cursor || undefined,
    status: statusRaw === null ? undefined : statusRaw,
  };
}

async function requireNewsKey(request: Request): Promise<Response | null> {
  const access = await authenticateApiKey(request.headers.get("authorization"), "news");
  if (!access.ok) return errorResponse(access.status, access.code, access.message);
  return null;
}

function pathParts(request: Request): string[] {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
  const marker = "/api/admin/";
  if (!pathname.startsWith(marker)) return [];
  return pathname.slice(marker.length).split("/").filter(Boolean);
}

function openApiResponse(request: Request): Response {
  const origin = new URL(request.url).origin;
  const document = buildAdminCmsOpenApiDocument(origin);
  return new Response(JSON.stringify(document), { status: 200, headers: PUBLIC_JSON_HEADERS });
}

function validateImageKeysField(keys: string[] | undefined): Response | null {
  if (!keys || keys.length === 0) return null;
  const message = validateNewsGalleryS3Keys(keys);
  if (message) return errorResponse(400, "invalid", message);
  return null;
}

export async function handleAdminApiRequest(request: Request): Promise<Response> {
  const parts = pathParts(request);
  if (parts.length === 1 && parts[0] === "openapi.json" && request.method === "GET") {
    return openApiResponse(request);
  }

  if (parts[0] === "media") {
    return handleMediaRequest(request, parts);
  }

  if (parts[0] !== "news") return errorResponse(404, "not_found", "Not found");

  if (parts.length === 1 && request.method === "GET") return listNews(request);
  if (parts.length === 1 && request.method === "POST") return createNews(request);

  const id = parts.length >= 2 ? newsId(parts[1] ?? "") : null;
  if (parts.length === 2 && request.method === "GET") {
    if (!id) return errorResponse(404, "not_found", "News article not found");
    return getNews(request, id);
  }
  if (parts.length === 2 && request.method === "PATCH") {
    if (!id) return errorResponse(404, "not_found", "News article not found");
    return updateNews(request, id);
  }
  if (parts.length === 3 && parts[2] === "publish" && request.method === "POST") {
    if (!id) return errorResponse(404, "not_found", "News article not found");
    return publishNews(request, id);
  }

  return errorResponse(404, "not_found", "Not found");
}

async function handleMediaRequest(request: Request, parts: string[]): Promise<Response> {
  if (parts.length === 2 && parts[1] === "upload-url" && request.method === "POST") {
    return mediaUploadUrl(request);
  }
  if (parts.length === 2 && parts[1] === "process" && request.method === "POST") {
    return mediaProcess(request);
  }
  return errorResponse(404, "not_found", "Not found");
}

async function mediaUploadUrl(request: Request): Promise<Response> {
  const denied = await requireNewsKey(request);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "invalid", "Invalid JSON body");
  }

  const parsed = mediaUploadUrlBodySchema.safeParse(raw);
  if (!parsed.success) return errorResponse(400, "invalid", "Invalid upload request");

  try {
    const result = await handleGetPresignedUrl({
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
      folder: "news",
    });
    return json({
      uploadUrl: result.uploadUrl,
      key: result.key,
      expiresIn: PRESIGNED_UPLOAD_EXPIRES_SECONDS,
    });
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to create upload URL");
  }
}

async function mediaProcess(request: Request): Promise<Response> {
  const denied = await requireNewsKey(request);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "invalid", "Invalid JSON body");
  }

  const parsed = mediaProcessBodySchema.safeParse(raw);
  if (!parsed.success) return errorResponse(400, "invalid", "Invalid process request");

  const keyError = validateNewsGalleryS3Keys([parsed.data.s3Key]);
  if (keyError) return errorResponse(400, "invalid", keyError);

  try {
    await handleProcessMediaImage(parsed.data.s3Key);
    return json({ ok: true as const });
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to process image");
  }
}

async function listNews(request: Request): Promise<Response> {
  const denied = await requireNewsKey(request);
  if (denied) return denied;

  const query = readListQuery(new URL(request.url));
  if (!query.ok) return errorResponse(400, "invalid", query.message);

  try {
    const result = await handleListAdminNews({
      limit: query.limit,
      cursor: query.cursor,
      status: query.status,
    });
    return jsonNewsList(request, result);
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to list news");
  }
}

async function getNews(request: Request, id: string): Promise<Response> {
  const denied = await requireNewsKey(request);
  if (denied) return denied;

  try {
    const article = await handleGetNewsById(id);
    if (!article) return errorResponse(404, "not_found", "News article not found");
    return jsonNews(request, article);
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to read news");
  }
}

async function createNews(request: Request): Promise<Response> {
  const denied = await requireNewsKey(request);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "invalid", "Invalid JSON body");
  }

  const parsed = createNewsBodySchema.safeParse(raw);
  if (!parsed.success) return errorResponse(400, "invalid", "Invalid news article");

  const keyError = validateImageKeysField(parsed.data.imageS3Keys);
  if (keyError) return keyError;

  try {
    const article = await handleCreateDraftNews({
      title: parsed.data.title,
      content: parsed.data.content,
      excerpt: parsed.data.excerpt,
      imageS3Keys: parsed.data.imageS3Keys,
      tags: parsed.data.tags,
      status: parsed.data.status ?? "draft",
    });
    return jsonNews(request, article, 201);
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to create news");
  }
}

async function updateNews(request: Request, id: string): Promise<Response> {
  const denied = await requireNewsKey(request);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse(400, "invalid", "Invalid JSON body");
  }

  const parsed = updateNewsBodySchema.safeParse(raw);
  if (!parsed.success) return errorResponse(400, "invalid", "Invalid news article update");

  const keyError = validateImageKeysField(parsed.data.imageS3Keys);
  if (keyError) return keyError;

  try {
    const article = await handleUpdateNewsContent(id, parsed.data);
    if (!article) return errorResponse(404, "not_found", "News article not found");
    return jsonNews(request, article);
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to update news");
  }
}

async function publishNews(request: Request, id: string): Promise<Response> {
  const denied = await requireNewsKey(request);
  if (denied) return denied;

  try {
    const article = await handlePublishNews(id);
    if (!article) return errorResponse(404, "not_found", "News article not found");
    return jsonNews(request, article);
  } catch (error) {
    console.error(error);
    return errorResponse(500, "internal", "Failed to publish news");
  }
}
