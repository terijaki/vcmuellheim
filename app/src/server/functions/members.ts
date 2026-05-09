/**
 * Members server functions — replaces lib/trpc/routers/members.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import { memberSchema } from "@/lib/db/schemas";
import { requireAdminMiddleware } from "../../middleware";
import { withTimestamps } from "../dynamo";
import { parseServerArray, parseServerData } from "../schema-parse";
import { resolveNullableUpdates } from "./patch-helpers";
import {
  canonicalizeProxyAlias,
  getProxyAliasBranchName,
  getProxyAliasDomain,
  suggestProxyAlias,
} from "./member-alias";

// ── Public member schema (excludes admin-only fields for privacy boundary) ───
export const publicMemberSchema = memberSchema.omit({ privateEmail: true, authRole: true });
export type PublicMember = z.infer<typeof publicMemberSchema>;

// ── Public ──────────────────────────────────────────────────────────────────

export const listMembersFn = createServerFn().handler(async () => {
  const result = await db().member.query.byType({ type: "member" }).go({ pages: "all" });
  const items = parseServerArray(publicMemberSchema, result.data, "Failed to parse member list");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
});

export const getTrainersFn = createServerFn().handler(async () => {
  const result = await db()
    .member.query.byType({ type: "member" })
    .where((attr, op) => op.eq(attr.isTrainer, true))
    .go({ pages: "all" });
  const items = parseServerArray(publicMemberSchema, result.data, "Failed to parse trainer list");

  return {
    items,
    lastEvaluatedKey: result.cursor ?? undefined,
  };
});

// ── Protected ────────────────────────────────────────────────────────────────

export const createMemberFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .inputValidator(memberSchema.omit({ id: true, createdAt: true, updatedAt: true }))
  .handler(async ({ data }) => {
    const canonicalProxyEmail = data.proxyEmail
      ? canonicalizeProxyAlias(data.proxyEmail)
      : undefined;
    const member = withTimestamps({
      ...data,
      proxyEmail: canonicalProxyEmail,
      id: crypto.randomUUID(),
    });

    await db().member.create(member).go();

    return member;
  });

export const updateMemberFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .inputValidator(
    z.object({
      id: z.uuid(),
      data: memberSchema
        .omit({ id: true, createdAt: true, updatedAt: true })
        .partial()
        .extend({
          privateEmail: z.email().trim().nullable().optional(),
          proxyEmail: z.email().trim().nullable().optional(),
          phone: z.string().nullable().optional(),
          roleTitle: z.string().max(100).nullable().optional(),
          avatarS3Key: z.string().nullable().optional(),
          authRole: z.enum(["Admin", "Moderator"]).nullable().optional(),
        }),
    }),
  )
  .handler(async ({ data: { id, data: updates }, context }) => {
    // Guard: prevent admins from removing their own role
    if (id === context.userId && updates.authRole !== "Admin") {
      throw new Error("You cannot remove your own admin role");
    }

    const { privateEmail, proxyEmail, phone, roleTitle, avatarS3Key, authRole, ...restUpdates } =
      updates;
    const canonicalProxyEmail =
      proxyEmail && typeof proxyEmail === "string"
        ? canonicalizeProxyAlias(proxyEmail)
        : proxyEmail;
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
  });

export const deleteMemberFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .inputValidator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => {
    // Remove this member from all teams that reference them as a trainer
    const teamsResult = await db().team.query.byType({ type: "team" }).go({ pages: "all" });
    const teams = teamsResult.data;
    const teamsToUpdate = teams.filter((team) => team.trainerIds?.includes(data.id));
    for (const team of teamsToUpdate) {
      const updatedTrainerIds = team.trainerIds?.filter((id) => id !== data.id);
      await db()
        .team.patch({ id: team.id })
        .set({ trainerIds: updatedTrainerIds, updatedAt: new Date().toISOString() })
        .go();
    }

    await db().member.delete({ id: data.id }).go();

    return { success: true };
  });

// Admin list — returns full data including privateEmail (Admin role required)
export const adminListMembersFn = createServerFn()
  .middleware([requireAdminMiddleware])
  .handler(async () => {
    const result = await db().member.query.byType({ type: "member" }).go({ pages: "all" });
    const items = parseServerArray(memberSchema, result.data, "Failed to parse member list");

    return {
      items,
      lastEvaluatedKey: result.cursor ?? undefined,
    };
  });

// ── Proxy alias helpers (protected) ─────────────────────────────────────────
/** Suggest a free proxy alias. Appends a counter suffix if the base alias is already taken. */
export const suggestProxyAliasFn = createServerFn()
  .middleware([requireAdminMiddleware])
  .inputValidator(z.object({ name: z.string().min(1), excludeMemberId: z.uuid().optional() }))
  .handler(async ({ data: { name, excludeMemberId } }) => {
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
  });

export const checkProxyEmailFn = createServerFn()
  .middleware([requireAdminMiddleware])
  .inputValidator(z.object({ proxyEmail: z.email(), excludeMemberId: z.uuid().optional() }))
  .handler(async ({ data: { proxyEmail, excludeMemberId } }) => {
    const canonicalProxyEmail = canonicalizeProxyAlias(proxyEmail);
    const result = await db().member.query.byProxyEmail({ proxyEmail: canonicalProxyEmail }).go();
    const existing = result.data.filter((m) => m.id !== excludeMemberId);
    return { available: existing.length === 0 };
  });
