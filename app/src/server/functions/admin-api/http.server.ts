/**
 * Shared HTTP helpers for the programmatic CMS API (/api/admin/*).
 */

import type { ApiKeyScope } from "../../api-keys.server";
import { authenticateApiKey } from "../../api-keys.server";
import {
  buildApiErrorBody,
  zodValidationDetails,
  zodValidationMessage,
} from "../../admin-api-errors";
import { z } from "zod";

export const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "private, no-store",
} as const;

export const PUBLIC_JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
} as const;

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  extra?: { reason?: string; details?: { path: string; message: string }[] },
): Response {
  return new Response(JSON.stringify(buildApiErrorBody(code, message, extra)), {
    status,
    headers: JSON_HEADERS,
  });
}

export function invalidBodyResponse(error: z.ZodError): Response {
  const details = zodValidationDetails(error);
  return new Response(
    JSON.stringify(buildApiErrorBody("invalid", zodValidationMessage(error), { details })),
    { status: 400, headers: JSON_HEADERS },
  );
}

export function resourceId(value: string): string | null {
  return z.uuid().safeParse(value).success ? value : null;
}

export async function requireApiKeyScope(
  request: Request,
  scope: ApiKeyScope,
  options?: { requireAdmin?: boolean },
): Promise<Response | null> {
  const access = await authenticateApiKey(request.headers.get("authorization"), scope, options);
  if (!access.ok) {
    return errorResponse(access.status, access.code, access.message, { reason: access.reason });
  }
  return null;
}

export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; raw: unknown } | { ok: false }> {
  try {
    return { ok: true, raw: await request.json() };
  } catch {
    return { ok: false };
  }
}
