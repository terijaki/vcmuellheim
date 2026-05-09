/**
 * Minimal better-auth adapter for member-as-user identity.
 *
 * Supports only what email OTP + stateless JWE sessions require:
 * - findOne "user" by id or by email (canonical privateEmail or proxyEmail alias)
 *
 * OTP verification codes are stored via SecondaryStorage (auth-secondary-storage.ts),
 * so the verification/session/account models never touch this adapter.
 *
 * Identity model:
 *   Members with authRole "Admin" or "Moderator" are the auth user identity.
 *   `privateEmail` (canonical) is mapped to better-auth's `email` field.
 *   `proxyEmail` (alias) is also accepted as login input — the session always
 *   holds the canonical `privateEmail` as `email`.
 */

import { createAdapterFactory } from "better-auth/adapters";
import { db } from "@/lib/db/electrodb-client";

type ElectroItem = Record<string, unknown>;

/**
 * Converts a member DynamoDB item to the "auth view" better-auth expects:
 * exposes `privateEmail` as `email` (canonical auth identity).
 *
 * `emailVerified` is always set to `true` because members with Admin/Moderator
 * authRole are pre-configured by admins, and OTP delivery proves email ownership.
 * Without this, better-auth's signInEmailOTP calls updateUser() to flip the flag,
 * but our update() no-op returns null which crashes refreshUserSessions().
 */
function toAuthView(member: ElectroItem): ElectroItem {
  const { privateEmail, ...rest } = member as { privateEmail?: unknown } & ElectroItem;
  return { ...rest, email: privateEmail ?? "", emailVerified: true };
}

export const memberAuthAdapter = createAdapterFactory({
  config: {
    adapterId: "member-auth",
    adapterName: "MemberAuth",
    supportsNumericIds: false,
    supportsUUIDs: true,
    supportsDates: false,
    usePlural: false,
    transaction: false,
  },
  adapter: ({ getModelName }) => ({
    async findOne({ model, where, select }) {
      const resolvedModel = getModelName(model);
      if (resolvedModel !== "user") return null;

      const idWhere = where.find((w) => w.field === "id");
      if (idWhere) {
        const { data: item } = await db()
          .member.get({ id: idWhere.value as string })
          .go();
        if (!item) return null;
        const member = item as ElectroItem;
        if (member.authRole !== "Admin" && member.authRole !== "Moderator") return null;
        const result = toAuthView(member);
        return applySelect(result, select) as ReturnType<typeof Object.assign>;
      }

      const emailWhere = where.find((w) => w.field === "email");
      if (emailWhere) {
        const inputEmail = emailWhere.value as string;

        // 1. Try byPrivateEmail — canonical auth identity
        const { data: byPrivate } = await db()
          .member.query.byPrivateEmail({ privateEmail: inputEmail })
          .go({ limit: 1 });
        const privateMatch = (byPrivate as ElectroItem[]).find(
          (m) => m.authRole === "Admin" || m.authRole === "Moderator",
        );
        if (privateMatch) {
          return applySelect(toAuthView(privateMatch), select) as ReturnType<typeof Object.assign>;
        }

        // 2. Try byProxyEmail — alias path; OTP is delivered to privateEmail
        const { data: byProxy } = await db()
          .member.query.byProxyEmail({ proxyEmail: inputEmail })
          .go({ limit: 1 });
        const proxyMatch = (byProxy as ElectroItem[]).find(
          (m) => m.authRole === "Admin" || m.authRole === "Moderator",
        );
        if (proxyMatch) {
          return applySelect(toAuthView(proxyMatch), select) as ReturnType<typeof Object.assign>;
        }

        return null;
      }

      return null;
    },

    // No-ops: sign-up is disabled; sessions/accounts are not stored in the DB
    async create() {
      return null as never;
    },
    async findMany() {
      return [];
    },
    async update() {
      return null;
    },
    async updateMany() {
      return 0;
    },
    async delete() {
      return;
    },
    async deleteMany() {
      return 0;
    },
    async count() {
      return 0;
    },
  }),
});

function applySelect(item: ElectroItem, select?: string[]): ElectroItem {
  if (!select || select.length === 0) return item;
  const result: ElectroItem = {};
  for (const key of select) {
    if (key in item) result[key] = item[key];
  }
  return result;
}
