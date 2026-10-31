import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { docClient } from "@/lib/db/client";
import {
  memberEmailIndexFromDomain,
  memberItemFromDomain,
  memberMainKeys,
  memberPrivateEmailKeys,
  memberProxyEmailKeys,
  trimMemberEmail,
} from "@/lib/db/content-keys";
import { getContentTableName } from "@/lib/db/env";
import { memberSchema } from "@/lib/db/schemas";
import type { Member } from "@/lib/db/types";
import {
  deleteItem,
  getItem,
  parseDomain,
  putItem,
  queryGsi1,
  queryTablePk,
} from "@/lib/db/repositories/dynamo-helpers";

export class MemberRepository {
  constructor(
    private readonly documentClient: DynamoDBDocumentClient = docClient,
    private readonly tableName?: string,
  ) {}

  private table(): string {
    return this.tableName ?? getContentTableName();
  }

  async getById(id: string): Promise<Member | null> {
    const item = await getItem(this.documentClient, this.table(), memberMainKeys(id));
    return item ? parseDomain(memberSchema, item, "Failed to parse member") : null;
  }

  async getByPrivateEmail(privateEmail: string): Promise<Member | null> {
    const lookup = await getItem(
      this.documentClient,
      this.table(),
      memberPrivateEmailKeys(privateEmail),
    );
    if (!lookup || typeof lookup.memberId !== "string") return null;
    return this.getById(lookup.memberId);
  }

  async getByProxyEmail(proxyEmail: string): Promise<Member | null> {
    const lookup = await getItem(
      this.documentClient,
      this.table(),
      memberProxyEmailKeys(proxyEmail),
    );
    if (!lookup || typeof lookup.memberId !== "string") return null;
    return this.getById(lookup.memberId);
  }

  async listAll(): Promise<Member[]> {
    const page = await queryGsi1(this.documentClient, this.table(), {
      gsi1pk: "member",
      scanIndexForward: false,
    });
    return page.items.map((item) => parseDomain(memberSchema, item, "Failed to parse member"));
  }

  async listTrainers(): Promise<Member[]> {
    const members = await this.listAll();
    return members.filter((m) => m.isTrainer === true);
  }

  async listBoardMembers(): Promise<Member[]> {
    const members = await this.listAll();
    return members.filter((m) => m.isBoardMember === true);
  }

  private async syncEmailIndexes(before: Member | null, after: Member): Promise<void> {
    const table = this.table();
    if (
      before?.privateEmail &&
      trimMemberEmail(before.privateEmail) !== trimMemberEmail(after.privateEmail ?? "")
    ) {
      await deleteItem(this.documentClient, table, memberPrivateEmailKeys(before.privateEmail));
    }
    if (
      before?.proxyEmail &&
      trimMemberEmail(before.proxyEmail) !== trimMemberEmail(after.proxyEmail ?? "")
    ) {
      await deleteItem(this.documentClient, table, memberProxyEmailKeys(before.proxyEmail));
    }
    const privateIndex = memberEmailIndexFromDomain(after, "private");
    if (privateIndex) await putItem(this.documentClient, table, privateIndex);
    const proxyIndex = memberEmailIndexFromDomain(after, "proxy");
    if (proxyIndex) await putItem(this.documentClient, table, proxyIndex);
  }

  async create(member: Member): Promise<Member> {
    const parsed = memberSchema.parse(member);
    await putItem(this.documentClient, this.table(), memberItemFromDomain(parsed));
    await this.syncEmailIndexes(null, parsed);
    return parsed;
  }

  async update(id: string, updates: Partial<Member>): Promise<Member | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    const merged = memberSchema.parse({ ...existing, ...updates, id });
    await putItem(this.documentClient, this.table(), memberItemFromDomain(merged));
    await this.syncEmailIndexes(existing, merged);
    return merged;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) return;
    const table = this.table();
    await deleteItem(this.documentClient, table, memberMainKeys(id));
    if (existing.privateEmail) {
      await deleteItem(this.documentClient, table, memberPrivateEmailKeys(existing.privateEmail));
    }
    if (existing.proxyEmail) {
      await deleteItem(this.documentClient, table, memberProxyEmailKeys(existing.proxyEmail));
    }
  }

  async queryByProxyEmailPrefix(canonicalProxyEmail: string): Promise<Member[]> {
    const prefix = trimMemberEmail(canonicalProxyEmail);
    const page = await queryTablePk(this.documentClient, this.table(), {
      pk: `member#proxy#${prefix}`,
    });
    if (page.items.length > 0) {
      const memberId = page.items[0].memberId;
      if (typeof memberId === "string") {
        const member = await this.getById(memberId);
        return member ? [member] : [];
      }
    }
    return [];
  }
}

export const memberRepository = new MemberRepository();
