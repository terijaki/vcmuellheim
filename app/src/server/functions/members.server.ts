/**
 * Members server-only helpers — DynamoDB access.
 */

import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { memberSchema } from "@/lib/db/schemas";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";
import {
  canonicalizeProxyAlias,
  getProxyAliasBranchName,
  getProxyAliasDomain,
  suggestProxyAlias,
} from "./member-alias";
import { resolveNullableUpdates } from "./patch-helpers";

const memberInputSchema = memberSchema.omit({ id: true, createdAt: true, updatedAt: true });
const publicMemberSchema = memberSchema.omit({ privateEmail: true, authRole: true });

const memberUpdateDataSchema = memberSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial()
  .extend({
    privateEmail: z.email().trim().nullable().optional(),
    proxyEmail: z.email().trim().nullable().optional(),
    phone: z.string().nullable().optional(),
    roleTitle: z.string().max(100).nullable().optional(),
    avatarS3Key: z.string().nullable().optional(),
    authRole: z.enum(["Admin", "Moderator"]).nullable().optional(),
  });

type MemberInput = z.infer<typeof memberInputSchema>;
type MemberUpdateInput = z.infer<typeof memberUpdateDataSchema>;

export async function handleListPublicMembers() {
  const result = await db().member.query.byType({ type: "member" }).go({ pages: "all" });
  const items = parseServerArray(publicMemberSchema, result.data, "Failed to parse member list");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
}

export async function handleGetTrainers() {
  const result = await db()
    .member.query.byType({ type: "member" })
    .where((attr, op) => op.eq(attr.isTrainer, true))
    .go({ pages: "all" });
  const items = parseServerArray(publicMemberSchema, result.data, "Failed to parse trainer list");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
}

export async function handleCreateMember(data: MemberInput) {
  const canonicalProxyEmail = data.proxyEmail ? canonicalizeProxyAlias(data.proxyEmail) : undefined;
  const member = withTimestamps({
    ...data,
    proxyEmail: canonicalProxyEmail,
    id: crypto.randomUUID(),
  });

  await db().member.create(member).go();

  return member;
}

export async function handleUpdateMember(id: string, updates: MemberUpdateInput, userId: string) {
  if (id === userId && updates.authRole !== "Admin") {
    throw new Error("You cannot remove your own admin role");
  }

  const { privateEmail, proxyEmail, phone, roleTitle, avatarS3Key, authRole, ...restUpdates } =
    updates;
  const canonicalProxyEmail =
    proxyEmail && typeof proxyEmail === "string" ? canonicalizeProxyAlias(proxyEmail) : proxyEmail;
  const { setFields: nullableFields, removeKeys } = resolveNullableUpdates({
    privateEmail,
    proxyEmail: canonicalProxyEmail,
    phone,
    roleTitle,
    avatarS3Key,
    authRole,
  });

  const setFields = {
    ...restUpdates,
    ...nullableFields,
    updatedAt: new Date().toISOString(),
  };
  const patchOp = db().member.patch({ id }).set(setFields);
  const result = await (removeKeys.length > 0 ? patchOp.remove(removeKeys) : patchOp).go();

  if (!result.data) throw new Error("Member not found");

  const refreshedResult = await db().member.get({ id }).go();
  const member = refreshedResult.data
    ? parseServerData(memberSchema, refreshedResult.data, "Failed to parse member data")
    : null;

  if (!member) throw new Error("Member not found");
  return member;
}

export async function handleDeleteMember(id: string) {
  const teamsResult = await db().team.query.byType({ type: "team" }).go({ pages: "all" });
  const teams = teamsResult.data;
  const teamsToUpdate = teams.filter((team) => team.trainerIds?.includes(id));
  for (const team of teamsToUpdate) {
    const updatedTrainerIds = team.trainerIds?.filter((trainerId) => trainerId !== id);
    await db()
      .team.patch({ id: team.id })
      .set({ trainerIds: updatedTrainerIds, updatedAt: new Date().toISOString() })
      .go();
  }

  await db().member.delete({ id }).go();

  return { success: true as const };
}

export async function handleListAdminMembers() {
  const result = await db().member.query.byType({ type: "member" }).go({ pages: "all" });
  const items = parseServerArray(memberSchema, result.data, "Failed to parse member list");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
}

export async function handleSuggestProxyAlias(name: string, excludeMemberId?: string) {
  const aliasDomain = getProxyAliasDomain();
  const aliasBranchName = getProxyAliasBranchName();
  let alias = suggestProxyAlias(name, aliasDomain, aliasBranchName);
  for (let counter = 2; counter <= 99; counter++) {
    const result = await db().member.query.byProxyEmail({ proxyEmail: alias }).go();
    const existing = result.data.filter((m) => m.id !== excludeMemberId);
    if (existing.length === 0) break;
    alias = suggestProxyAlias(name, aliasDomain, aliasBranchName, counter);
  }
  return { alias };
}

export async function handleCheckProxyEmail(proxyEmail: string, excludeMemberId?: string) {
  const canonicalProxyEmail = canonicalizeProxyAlias(proxyEmail);
  const result = await db().member.query.byProxyEmail({ proxyEmail: canonicalProxyEmail }).go();
  const existing = result.data.filter((m) => m.id !== excludeMemberId);
  return { available: existing.length === 0 };
}

export type { MemberUpdateInput };
