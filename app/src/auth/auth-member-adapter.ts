/**
 * Minimal better-auth adapter for member-as-user identity.
 */

import { createAdapterFactory } from "better-auth/adapters";
import { memberRepository } from "@/lib/db/repositories/member-repository";

type ElectroItem = Record<string, unknown>;

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
        const item = await memberRepository.getById(idWhere.value as string);
        if (!item) return null;
        const member = item as ElectroItem;
        if (member.authRole !== "Admin" && member.authRole !== "Moderator") return null;
        const result = toAuthView(member);
        return applySelect(result, select) as ReturnType<typeof Object.assign>;
      }

      const emailWhere = where.find((w) => w.field === "email");
      if (emailWhere) {
        const inputEmail = emailWhere.value as string;

        const privateMatchRaw = await memberRepository.getByPrivateEmail(inputEmail);
        if (
          privateMatchRaw &&
          (privateMatchRaw.authRole === "Admin" || privateMatchRaw.authRole === "Moderator")
        ) {
          return applySelect(toAuthView(privateMatchRaw), select) as ReturnType<
            typeof Object.assign
          >;
        }

        const proxyMatchRaw = await memberRepository.getByProxyEmail(inputEmail);
        if (
          proxyMatchRaw &&
          (proxyMatchRaw.authRole === "Admin" || proxyMatchRaw.authRole === "Moderator")
        ) {
          return applySelect(toAuthView(proxyMatchRaw), select) as ReturnType<typeof Object.assign>;
        }

        return null;
      }

      return null;
    },

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
