/**
 * Sponsors server-only helpers — DynamoDB access.
 */

import { z } from "zod";
import { sponsorRepository } from "@/lib/db/repositories/content-entities-repository";
import { sponsorSchema } from "@/lib/db/schemas";
import { readSponsors, rebuildSponsors } from "@/lib/read-models/public-snapshots";
import { handleGetFileUrls } from "./upload.server";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";
import { resolveNullableUpdates } from "./patch-helpers";

const sponsorInputSchema = sponsorSchema.omit({ id: true, createdAt: true, updatedAt: true });

const sponsorUpdateDataSchema = sponsorSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial()
  .extend({
    description: z.string().nullable().optional(),
    websiteUrl: z.url().nullable().optional(),
    logoS3Key: z.string().nullable().optional(),
    ttl: z.number().int().positive().nullable().optional(),
  });

type SponsorInput = z.infer<typeof sponsorInputSchema>;
type SponsorUpdateInput = z.infer<typeof sponsorUpdateDataSchema>;

export async function handleListPublicSponsors() {
  const snapshot = await readSponsors();
  if (!snapshot) return { items: [] };
  const source = snapshot;
  const keys = source.items.flatMap((sponsor) => (sponsor.logoS3Key ? [sponsor.logoS3Key] : []));
  const urls = keys.length > 0 ? await handleGetFileUrls(keys) : [];
  let index = 0;
  const items = source.items.map((sponsor) => {
    if (!sponsor.logoS3Key) return sponsor;
    const logoUrl = urls[index];
    index += 1;
    return logoUrl ? { ...sponsor, logoUrl } : sponsor;
  });
  return { items };
}

export async function handleListSponsors() {
  const sponsors = await sponsorRepository.listAll();
  const items = parseServerArray(sponsorSchema, sponsors, "Failed to parse sponsor list");
  return { items, lastEvaluatedKey: undefined };
}

export async function handleCreateSponsor(data: SponsorInput) {
  const sponsor = withTimestamps({
    ...data,
    id: crypto.randomUUID(),
  });

  await sponsorRepository.create(sponsor);
  await rebuildSponsors();

  return sponsor;
}

export async function handleUpdateSponsor(id: string, updates: SponsorUpdateInput) {
  const existing = await sponsorRepository.getById(id);
  if (!existing) throw new Error("Sponsor not found");

  const { description, websiteUrl, logoS3Key, ttl, ...restUpdates } = updates;
  const { setFields: nullableFields, removeKeys } = resolveNullableUpdates({
    description,
    websiteUrl,
    logoS3Key,
    ttl,
  });

  const merged = {
    ...existing,
    ...restUpdates,
    ...nullableFields,
    updatedAt: new Date().toISOString(),
  } as Record<string, unknown>;
  for (const key of removeKeys) {
    delete merged[key];
  }

  const sponsor = await sponsorRepository.update(id, merged);
  if (!sponsor) throw new Error("Sponsor not found");
  await rebuildSponsors();
  return parseServerData(sponsorSchema, sponsor, "Failed to parse sponsor data");
}

export async function handleDeleteSponsor(id: string) {
  await sponsorRepository.delete(id);
  await rebuildSponsors();
  return { success: true as const };
}
