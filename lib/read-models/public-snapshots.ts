import dayjs from "dayjs";
import { z } from "zod";
import { db } from "@/lib/db/electrodb-client";
import {
  eventSchema,
  memberSchema,
  newsSchema,
  publicSnapshotSchema,
  sponsorSchema,
  type PublicSnapshotSection,
} from "@/lib/db/schemas";
import { parseWithSchema } from "@/lib/sams/repository-utils";

/** Homepage keeps a few extra articles so the 3-month rule can still drop the tail. */
export const LATEST_NEWS_SNAPSHOT_COUNT = 8;

const publicMemberSchema = memberSchema.omit({ privateEmail: true, authRole: true });

export type PublicMemberCard = ReturnType<typeof toPublicMember>;

function toPublicMember(member: unknown) {
  return publicMemberSchema.parse(member);
}

export type PublicMembersPayload = {
  items: ReturnType<typeof toPublicMember>[];
  board: ReturnType<typeof toPublicMember>[];
  trainers: ReturnType<typeof toPublicMember>[];
  officials: ReturnType<typeof toPublicMember>[];
};

export type PublicEventsPayload = {
  items: Array<ReturnType<typeof eventSchema.parse> & { teamNames: string[] }>;
};

export type PublicNewsPayload = {
  items: Array<ReturnType<typeof newsSchema.parse>>;
};

export type PublicSponsorsPayload = {
  items: Array<ReturnType<typeof sponsorSchema.parse>>;
};

async function putSnapshot(section: PublicSnapshotSection, payload: unknown): Promise<void> {
  const item = parseWithSchema(
    publicSnapshotSchema,
    {
      section,
      type: "publicSnapshot",
      payload,
      updatedAt: new Date().toISOString(),
    },
    "Failed to parse public snapshot",
  );
  await db().publicSnapshot.put(item).go();
}

export async function readPublicSnapshot(section: PublicSnapshotSection): Promise<unknown | null> {
  const result = await db().publicSnapshot.get({ section }).go();
  if (!result.data) return null;
  return result.data.payload;
}

export async function rebuildUpcomingEvents(): Promise<PublicEventsPayload> {
  const [eventsResult, teamsResult] = await Promise.all([
    db().event.query.byType({ type: "event" }).go({ pages: "all" }),
    db().team.query.byType({ type: "team" }).go({ pages: "all" }),
  ]);
  const namesById = new Map(teamsResult.data.map((team) => [team.id, team.name]));
  const now = dayjs().toISOString();
  const items = eventsResult.data
    .map((event) => eventSchema.safeParse(event))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
    .filter((event) => event.startDate >= now)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))
    .map((event) => ({
      ...event,
      teamNames: (event.teamIds ?? []).flatMap((id) => {
        const name = namesById.get(id);
        return name ? [name] : [];
      }),
    }));

  const payload: PublicEventsPayload = { items };
  await putSnapshot("events", payload);
  return payload;
}

export async function rebuildLatestNews(): Promise<PublicNewsPayload> {
  const result = await db()
    .news.query.byStatus({ status: "published" })
    .gt({ createdAt: "2000-01-01T00:00:00.000Z" })
    .go({ order: "desc", limit: LATEST_NEWS_SNAPSHOT_COUNT });
  const items = result.data
    .map((article) => newsSchema.safeParse(article))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  const payload: PublicNewsPayload = { items };
  await putSnapshot("news", payload);
  return payload;
}

export async function rebuildSponsors(): Promise<PublicSponsorsPayload> {
  const result = await db().sponsor.query.byType({ type: "sponsor" }).go({ pages: "all" });
  const items = result.data
    .map((sponsor) => sponsorSchema.safeParse(sponsor))
    .flatMap((parsed) => (parsed.success ? [parsed.data] : []));
  const payload: PublicSponsorsPayload = { items };
  await putSnapshot("sponsors", payload);
  return payload;
}

export function buildPublicMembersPayload(members: readonly unknown[]): PublicMembersPayload {
  const items = members
    .map((member) => {
      const parsed = publicMemberSchema.safeParse(member);
      return parsed.success ? parsed.data : null;
    })
    .filter((member): member is NonNullable<typeof member> => member !== null);

  return {
    items,
    board: items.filter((member) => member.isBoardMember),
    trainers: items.filter((member) => member.isTrainer),
    officials: items.filter((member) => !member.isBoardMember && Boolean(member.roleTitle)),
  };
}

export async function rebuildPublicMembers(): Promise<PublicMembersPayload> {
  const result = await db().member.query.byType({ type: "member" }).go({ pages: "all" });
  const payload = buildPublicMembersPayload(result.data);
  await putSnapshot("members", payload);
  return payload;
}

const eventsPayloadSchema = z.object({
  items: z.array(eventSchema.extend({ teamNames: z.array(z.string()) })),
});
const newsPayloadSchema = z.object({
  items: z.array(newsSchema),
});
const sponsorsPayloadSchema = z.object({
  items: z.array(sponsorSchema),
});
const membersPayloadSchema = z.object({
  items: z.array(publicMemberSchema),
  board: z.array(publicMemberSchema),
  trainers: z.array(publicMemberSchema),
  officials: z.array(publicMemberSchema),
});

export async function readUpcomingEvents(): Promise<PublicEventsPayload | null> {
  const payload = await readPublicSnapshot("events");
  if (payload == null) return null;
  const parsed = eventsPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;
  const now = dayjs().toISOString();
  return {
    items: parsed.data.items.filter((event) => event.startDate >= now),
  };
}

export async function readLatestNews(): Promise<PublicNewsPayload | null> {
  const payload = await readPublicSnapshot("news");
  if (payload == null) return null;
  const parsed = newsPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export async function readSponsors(): Promise<PublicSponsorsPayload | null> {
  const payload = await readPublicSnapshot("sponsors");
  if (payload == null) return null;
  const parsed = sponsorsPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export async function readPublicMembers(): Promise<PublicMembersPayload | null> {
  const payload = await readPublicSnapshot("members");
  if (payload == null) return null;
  const parsed = membersPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export async function rebuildAllPublicSnapshots(): Promise<void> {
  await Promise.all([
    rebuildUpcomingEvents(),
    rebuildLatestNews(),
    rebuildSponsors(),
    rebuildPublicMembers(),
  ]);
}
