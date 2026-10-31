/**
 * Members server-only helpers — DynamoDB access.
 */

import { z } from "zod";
import { memberRepository } from "@/lib/db/repositories/member-repository";
import { teamRepository } from "@/lib/db/repositories/team-repository";
import { memberSchema } from "@/lib/db/schemas";
import { readPublicMembers, rebuildPublicMembers } from "@/lib/read-models/public-snapshots";
import { handleGetFileUrls } from "./upload.server";
import { withTimestamps } from "../dynamo";
import { parseServerArray } from "../schema-parse";
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

async function withAvatarUrls<T extends { avatarS3Key?: string }>(members: T[]) {
  const keys = members.flatMap((member) => (member.avatarS3Key ? [member.avatarS3Key] : []));
  const urls = keys.length > 0 ? await handleGetFileUrls(keys) : [];
  let index = 0;
  return members.map((member) => {
    if (!member.avatarS3Key) return member;
    const avatarUrl = urls[index];
    index += 1;
    return avatarUrl ? { ...member, avatarUrl } : member;
  });
}

export async function handleListPublicMembers() {
  const members = await memberRepository.listAll();
  const items = parseServerArray(publicMemberSchema, members, "Failed to parse member list");
  return { items, lastEvaluatedKey: undefined };
}

export async function handleGetHomeMembers() {
  const snapshot = await readPublicMembers();
  if (!snapshot) {
    return { items: [], board: [], trainers: [], officials: [] };
  }
  const grouped = snapshot;
  const items = await withAvatarUrls(grouped.items);
  const byId = new Map(items.map((member) => [member.id, member]));
  const pick = (group: typeof grouped.board) =>
    group.flatMap((member) => {
      const signed = byId.get(member.id);
      return signed ? [signed] : [];
    });

  return {
    items,
    board: pick(grouped.board),
    trainers: pick(grouped.trainers),
    officials: pick(grouped.officials),
  };
}

export async function handleGetTrainers() {
  const trainers = await memberRepository.listTrainers();
  const items = parseServerArray(publicMemberSchema, trainers, "Failed to parse trainer list");
  return { items, lastEvaluatedKey: undefined };
}

export async function handleCreateMember(data: MemberInput) {
  const canonicalProxyEmail = data.proxyEmail ? canonicalizeProxyAlias(data.proxyEmail) : undefined;
  const member = withTimestamps({
    ...data,
    proxyEmail: canonicalProxyEmail,
    id: crypto.randomUUID(),
  });

  await memberRepository.create(member);
  await rebuildPublicMembers();

  return member;
}

export async function handleUpdateMember(id: string, updates: MemberUpdateInput, userId: string) {
  if (id === userId && updates.authRole !== "Admin") {
    throw new Error("You cannot remove your own admin role");
  }

  const existing = await memberRepository.getById(id);
  if (!existing) throw new Error("Member not found");

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

  const merged = {
    ...existing,
    ...restUpdates,
    ...nullableFields,
    updatedAt: new Date().toISOString(),
  } as Record<string, unknown>;
  for (const key of removeKeys) {
    delete merged[key];
  }

  const member = await memberRepository.update(id, merged);
  if (!member) throw new Error("Member not found");
  await rebuildPublicMembers();
  return member;
}

export async function handleDeleteMember(id: string) {
  const teams = await teamRepository.listAll();
  const teamsToUpdate = teams.filter((team) => team.trainerIds?.includes(id));
  for (const team of teamsToUpdate) {
    const updatedTrainerIds = team.trainerIds?.filter((trainerId) => trainerId !== id);
    await teamRepository.update(team.id, {
      trainerIds: updatedTrainerIds,
      updatedAt: new Date().toISOString(),
    });
  }

  await memberRepository.delete(id);
  await rebuildPublicMembers();

  return { success: true as const };
}

export async function handleListAdminMembers() {
  const members = await memberRepository.listAll();
  const items = parseServerArray(memberSchema, members, "Failed to parse member list");
  return { items, lastEvaluatedKey: undefined };
}

export async function handleSuggestProxyAlias(name: string, excludeMemberId?: string) {
  const aliasDomain = getProxyAliasDomain();
  const aliasBranchName = getProxyAliasBranchName();
  let alias = suggestProxyAlias(name, aliasDomain, aliasBranchName);
  for (let counter = 2; counter <= 99; counter++) {
    const existing = await memberRepository.getByProxyEmail(alias);
    if (!existing || existing.id === excludeMemberId) break;
    alias = suggestProxyAlias(name, aliasDomain, aliasBranchName, counter);
  }
  return { alias };
}

export async function handleCheckProxyEmail(proxyEmail: string, excludeMemberId?: string) {
  const canonicalProxyEmail = canonicalizeProxyAlias(proxyEmail);
  const existing = await memberRepository.getByProxyEmail(canonicalProxyEmail);
  const available = !existing || existing.id === excludeMemberId;
  return { available };
}

export type { MemberUpdateInput };
