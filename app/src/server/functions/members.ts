/**
 * Members server functions — replaces lib/trpc/routers/members.ts
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { memberSchema } from "@/lib/db/schemas";
import { requireAdminMiddleware } from "../../middleware";
import {
  handleCheckProxyEmail,
  handleCreateMember,
  handleDeleteMember,
  handleGetTrainers,
  handleListAdminMembers,
  handleListPublicMembers,
  handleSuggestProxyAlias,
  handleUpdateMember,
} from "./members.server";

// Public member schema (excludes admin-only fields for privacy boundary)
export const publicMemberSchema = memberSchema.omit({ privateEmail: true, authRole: true });
export type PublicMember = z.infer<typeof publicMemberSchema>;

export const listMembersFn = createServerFn().handler(async () => handleListPublicMembers());

export const getTrainersFn = createServerFn().handler(async () => handleGetTrainers());

export const createMemberFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(memberSchema.omit({ id: true, createdAt: true, updatedAt: true }))
  .handler(async ({ data }) => handleCreateMember(data));

export const updateMemberFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(
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
  .handler(async ({ data: { id, data: updates }, context }) =>
    handleUpdateMember(id, updates, context.userId),
  );

export const deleteMemberFn = createServerFn({ method: "POST" })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.uuid() }))
  .handler(async ({ data }) => handleDeleteMember(data.id));

export const adminListMembersFn = createServerFn()
  .middleware([requireAdminMiddleware])
  .handler(async () => handleListAdminMembers());

export const suggestProxyAliasFn = createServerFn()
  .middleware([requireAdminMiddleware])
  .validator(z.object({ name: z.string().min(1), excludeMemberId: z.uuid().optional() }))
  .handler(async ({ data: { name, excludeMemberId } }) =>
    handleSuggestProxyAlias(name, excludeMemberId),
  );

export const checkProxyEmailFn = createServerFn()
  .middleware([requireAdminMiddleware])
  .validator(z.object({ proxyEmail: z.email(), excludeMemberId: z.uuid().optional() }))
  .handler(async ({ data: { proxyEmail, excludeMemberId } }) =>
    handleCheckProxyEmail(proxyEmail, excludeMemberId),
  );
