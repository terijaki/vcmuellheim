/**
 * CMS API keys. The bearer token is returned once at creation.
 * DynamoDB stores a hash, the owning member, one scope, and a one-year expiry.
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db/electrodb-client";
import {
  apiKeySchema,
  createApiKeyInputSchema,
  memberSchema,
  publicApiKeySchema,
} from "@/lib/db/schemas";
import type { ApiKey, PublicApiKey } from "@/lib/db/types";
import dayjs from "dayjs";
import { z } from "zod";
import { parseServerArray } from "./schema-parse";

export type ApiKeyScope = PublicApiKey["scope"];

const TOKEN_MARKER = "vcm_";
const TOKEN_PREFIX_LENGTH = 12;
const SCRYPT_PREFIX = "scrypt$";
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_DERIVED_BYTES = 32;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

const storedApiKeySchema = apiKeySchema.extend({ scope: z.string().min(1) });

export type ApiKeyAccess =
  | { ok: true; apiKey: PublicApiKey; memberId: string }
  | { ok: false; status: 401 | 403; code: "unauthorized" | "forbidden"; message: string };

const unauthorized: Extract<ApiKeyAccess, { ok: false }> = {
  ok: false,
  status: 401,
  code: "unauthorized",
  message: "Unauthorized",
};

const forbidden: Extract<ApiKeyAccess, { ok: false }> = {
  ok: false,
  status: 403,
  code: "forbidden",
  message: "Forbidden",
};

function isCmsRole(role: string | undefined): role is "Admin" | "Moderator" {
  return role === "Admin" || role === "Moderator";
}

function hashSecret(secret: string): string {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = scryptSync(secret, salt, SCRYPT_DERIVED_BYTES, SCRYPT_OPTIONS);
  return `${SCRYPT_PREFIX}${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

function secretsMatch(storedHash: string, secret: string): boolean {
  if (!storedHash.startsWith(SCRYPT_PREFIX)) return false;
  const payload = storedHash.slice(SCRYPT_PREFIX.length);
  const separator = payload.indexOf("$");
  if (separator <= 0) return false;

  const salt = Buffer.from(payload.slice(0, separator), "base64url");
  const expected = Buffer.from(payload.slice(separator + 1), "base64url");
  if (salt.length === 0 || expected.length === 0) return false;

  const derived = scryptSync(secret, salt, expected.length, SCRYPT_OPTIONS);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function parseToken(token: string): { id: string; secret: string } | null {
  if (!token.startsWith(TOKEN_MARKER)) return null;
  const body = token.slice(TOKEN_MARKER.length);
  if (body.length < 38 || body[36] !== "_") return null;
  const id = body.slice(0, 36);
  const secret = body.slice(37);
  if (!zUuid(id) || secret.length < 16) return null;
  return { id, secret };
}

function zUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function apiKeyExpiresAt(createdAt: string): string {
  return dayjs(createdAt).add(1, "year").toISOString();
}

function isSameUtcMinute(left: string, right: string): boolean {
  return left.slice(0, 16) === right.slice(0, 16);
}

function toPublicApiKey(key: ApiKey): PublicApiKey {
  return publicApiKeySchema.parse({
    id: key.id,
    type: key.type,
    label: key.label,
    memberId: key.memberId,
    scope: key.scope,
    prefix: key.prefix,
    createdAt: key.createdAt,
    expiresAt: key.expiresAt,
    ...(key.lastUsedAt ? { lastUsedAt: key.lastUsedAt } : {}),
  });
}

async function memberMayUseKeys(memberId: string): Promise<boolean> {
  const result = await db().member.get({ id: memberId }).go();
  if (!result.data) return false;
  const member = memberSchema.safeParse(result.data);
  return member.success && isCmsRole(member.data.authRole);
}

export async function createApiKey(input: {
  label: string;
  memberId: string;
  scope: ApiKeyScope;
}): Promise<{ apiKey: PublicApiKey; token: string }> {
  const parsed = createApiKeyInputSchema.parse(input);
  if (!(await memberMayUseKeys(parsed.memberId))) {
    throw new Error("Nur Admins und Moderatoren können einen Schlüssel erhalten");
  }

  const id = crypto.randomUUID();
  const secret = randomBytes(32).toString("base64url");
  const token = `${TOKEN_MARKER}${id}_${secret}`;
  const createdAt = new Date().toISOString();
  const record: ApiKey = {
    id,
    type: "apiKey",
    label: parsed.label,
    memberId: parsed.memberId,
    scope: parsed.scope,
    secretHash: hashSecret(secret),
    prefix: token.slice(0, TOKEN_PREFIX_LENGTH),
    createdAt,
    expiresAt: apiKeyExpiresAt(createdAt),
  };

  await db().apiKey.create(record).go();
  return { apiKey: toPublicApiKey(record), token };
}

export async function listApiKeys(): Promise<PublicApiKey[]> {
  const result = await db().apiKey.query.byType({ type: "apiKey" }).go({ pages: "all" });
  const keys = parseServerArray(apiKeySchema, result.data, "Failed to parse API keys");
  keys.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return keys.map((key) => toPublicApiKey(key));
}

export async function deleteApiKey(id: string): Promise<{ success: true }> {
  const existing = await db().apiKey.get({ id }).go();
  if (!existing.data) throw new Error("API-Schlüssel nicht gefunden");
  await db().apiKey.delete({ id }).go();
  return { success: true };
}

export async function authenticateApiKey(
  authorizationHeader: string | null,
  requiredScope: ApiKeyScope,
  now = new Date(),
): Promise<ApiKeyAccess> {
  const header = authorizationHeader ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  const parsedToken = presented ? parseToken(presented) : null;
  if (!parsedToken) return unauthorized;

  const result = await db().apiKey.get({ id: parsedToken.id }).go();
  if (!result.data) return unauthorized;

  const record = storedApiKeySchema.safeParse(result.data);
  if (!record.success) return unauthorized;
  if (!secretsMatch(record.data.secretHash, parsedToken.secret)) return unauthorized;

  const nowIso = now.toISOString();
  if (!dayjs(record.data.expiresAt).isAfter(now)) return unauthorized;
  if (record.data.scope !== requiredScope) return forbidden;
  if (!(await memberMayUseKeys(record.data.memberId))) return forbidden;

  const previousUse = record.data.lastUsedAt;
  const shouldRecordUse = !previousUse || !isSameUtcMinute(previousUse, nowIso);
  if (shouldRecordUse) {
    await db().apiKey.patch({ id: record.data.id }).set({ lastUsedAt: nowIso }).go();
  }

  const apiKey = toPublicApiKey({
    id: record.data.id,
    type: "apiKey",
    label: record.data.label,
    memberId: record.data.memberId,
    scope: requiredScope,
    secretHash: record.data.secretHash,
    prefix: record.data.prefix,
    createdAt: record.data.createdAt,
    expiresAt: record.data.expiresAt,
    lastUsedAt: shouldRecordUse ? nowIso : previousUse,
  });

  return { ok: true, apiKey, memberId: record.data.memberId };
}
