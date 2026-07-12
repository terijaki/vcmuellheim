/**
 * Sponsors server-only helpers — DynamoDB access.
 */

import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { sponsorSchema } from "@/lib/db/schemas";
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

export async function handleListSponsors() {
  const result = await db().sponsor.query.byType({ type: "sponsor" }).go({ pages: "all" });
  const items = parseServerArray(sponsorSchema, result.data, "Failed to parse sponsor list");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
}

export async function handleCreateSponsor(data: SponsorInput) {
  const sponsor = withTimestamps({
    ...data,
    id: crypto.randomUUID(),
  });

  await db().sponsor.create(sponsor).go();

  return sponsor;
}

export async function handleUpdateSponsor(id: string, updates: SponsorUpdateInput) {
  const { description, websiteUrl, logoS3Key, ttl, ...restUpdates } = updates;
  const { setFields: nullableFields, removeKeys } = resolveNullableUpdates({
    description,
    websiteUrl,
    logoS3Key,
    ttl,
  });

  const setFields = {
    ...restUpdates,
    ...nullableFields,
    updatedAt: new Date().toISOString(),
  };
  const patchOp = db().sponsor.patch({ id }).set(setFields);
  const result = await (removeKeys.length > 0 ? patchOp.remove(removeKeys) : patchOp).go();

  if (!result.data) throw new Error("Sponsor not found");

  const refreshedResult = await db().sponsor.get({ id }).go();
  const sponsor = refreshedResult.data
    ? parseServerData(sponsorSchema, refreshedResult.data, "Failed to parse sponsor data")
    : null;

  if (!sponsor) throw new Error("Sponsor not found");
  return sponsor;
}

export async function handleDeleteSponsor(id: string) {
  await db().sponsor.delete({ id }).go();
  return { success: true as const };
}
