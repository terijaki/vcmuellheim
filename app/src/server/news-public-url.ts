import type { News } from "@/lib/db/types";

export function buildNewsPublicUrl(origin: string, articleId: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/news/${articleId}`;
}

export function resolveNewsPublicOrigin(request: Request): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

export type NewsWithPublicUrl = News & { publicUrl: string };

export function withNewsPublicUrl(origin: string, article: News): NewsWithPublicUrl {
  return { ...article, publicUrl: buildNewsPublicUrl(origin, article.id) };
}
