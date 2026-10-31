import type { z } from "zod";
import {
  apiKeySchema,
  busSchema,
  eventSchema,
  locationSchema,
  mediaSchema,
  memberSchema,
  newsSchema,
  publicSnapshotSchema,
  sponsorSchema,
  teamSchema,
  volunteerEventSchema,
  volunteerSignupSchema,
  volunteerTokenSchema,
  type PublicSnapshotSection,
} from "@/lib/db/schemas";

export function trimMemberEmail(email: string): string {
  return email.trim();
}

function mainKeys(entity: string, id: string): { pk: string; sk: string } {
  return { pk: `${entity}#${id}`, sk: entity };
}

export function newsMainKeys(id: string) {
  return mainKeys("news", id);
}

export function newsSlugLookupKeys(slug: string) {
  return { pk: `news#slug#${slug}`, sk: "news" };
}

export function newsGsi1(status: string, createdAt: string) {
  return { gsi1pk: `news#${status}`, gsi1sk: createdAt };
}

export function newsItemFromDomain(item: z.infer<typeof newsSchema>) {
  return {
    ...newsMainKeys(item.id),
    ...newsGsi1(item.status, item.createdAt),
    ...item,
  };
}

export function newsSlugLookupFromDomain(item: z.infer<typeof newsSchema>) {
  return {
    ...newsSlugLookupKeys(item.slug),
    id: item.id,
    slug: item.slug,
    type: item.type,
  };
}

export function eventMainKeys(id: string) {
  return mainKeys("event", id);
}

export function eventGsi1(startDate: string) {
  return { gsi1pk: "event", gsi1sk: startDate };
}

export function eventItemFromDomain(item: z.infer<typeof eventSchema>) {
  return {
    ...eventMainKeys(item.id),
    ...eventGsi1(item.startDate),
    ...item,
  };
}

export function teamMainKeys(id: string) {
  return mainKeys("team", id);
}

export function teamSlugLookupKeys(slug: string) {
  return { pk: `team#slug#${slug}`, sk: "team" };
}

export function teamGsi1(slug: string) {
  return { gsi1pk: "team", gsi1sk: slug };
}

export function teamItemFromDomain(item: z.infer<typeof teamSchema>) {
  return {
    ...teamMainKeys(item.id),
    ...teamGsi1(item.slug),
    ...item,
  };
}

export function teamSlugLookupFromDomain(item: z.infer<typeof teamSchema>) {
  return {
    ...teamSlugLookupKeys(item.slug),
    id: item.id,
    slug: item.slug,
    type: item.type,
  };
}

export function memberMainKeys(id: string) {
  return mainKeys("member", id);
}

export function memberPrivateEmailKeys(privateEmail: string) {
  const trimmed = trimMemberEmail(privateEmail);
  return { pk: `member#private#${trimmed}`, sk: "member" };
}

export function memberProxyEmailKeys(proxyEmail: string) {
  const trimmed = trimMemberEmail(proxyEmail);
  return { pk: `member#proxy#${trimmed}`, sk: "member" };
}

export function memberGsi1(updatedAt: string) {
  return { gsi1pk: "member", gsi1sk: updatedAt };
}

export function memberItemFromDomain(item: z.infer<typeof memberSchema>) {
  return {
    ...memberMainKeys(item.id),
    ...memberGsi1(item.updatedAt),
    ...item,
  };
}

export function memberEmailIndexFromDomain(
  item: z.infer<typeof memberSchema>,
  kind: "private" | "proxy",
) {
  const email = kind === "private" ? item.privateEmail : item.proxyEmail;
  if (!email) return null;
  const keys = kind === "private" ? memberPrivateEmailKeys(email) : memberProxyEmailKeys(email);
  return {
    ...keys,
    memberId: item.id,
    type: item.type,
  };
}

export function mediaMainKeys(id: string) {
  return mainKeys("media", id);
}

export function mediaItemFromDomain(item: z.infer<typeof mediaSchema>) {
  return { ...mediaMainKeys(item.id), ...item };
}

export function sponsorMainKeys(id: string) {
  return mainKeys("sponsor", id);
}

export function sponsorGsi1(updatedAt: string) {
  return { gsi1pk: "sponsor", gsi1sk: updatedAt };
}

export function sponsorItemFromDomain(item: z.infer<typeof sponsorSchema>) {
  return {
    ...sponsorMainKeys(item.id),
    ...sponsorGsi1(item.updatedAt),
    ...item,
  };
}

export function locationMainKeys(id: string) {
  return mainKeys("location", id);
}

export function locationGsi1(updatedAt: string) {
  return { gsi1pk: "location", gsi1sk: updatedAt };
}

export function locationItemFromDomain(item: z.infer<typeof locationSchema>) {
  return {
    ...locationMainKeys(item.id),
    ...locationGsi1(item.updatedAt),
    ...item,
  };
}

export function busMainKeys(id: string) {
  return mainKeys("bus", id);
}

export function busGsi1(updatedAt: string) {
  return { gsi1pk: "bus", gsi1sk: updatedAt };
}

export function busItemFromDomain(item: z.infer<typeof busSchema>) {
  return {
    ...busMainKeys(item.id),
    ...busGsi1(item.updatedAt),
    ...item,
  };
}

export function volunteerEventMainKeys(id: string) {
  return mainKeys("volunteerEvent", id);
}

export function volunteerEventGsi1(createdAt: string) {
  return { gsi1pk: "volunteerEvent", gsi1sk: createdAt };
}

export function volunteerEventItemFromDomain(item: z.infer<typeof volunteerEventSchema>) {
  return {
    ...volunteerEventMainKeys(item.id),
    ...volunteerEventGsi1(item.createdAt),
    ...item,
  };
}

export function volunteerSignupCollectionKeys(eventId: string, shiftId: string, signupId: string) {
  return {
    pk: `volunteerSignup#${eventId}`,
    sk: `${shiftId}#${signupId}`,
  };
}

export function volunteerSignupIdLookupKeys(signupId: string) {
  return { pk: `volunteerSignup#id#${signupId}`, sk: "volunteerSignup" };
}

export function volunteerSignupCollectionItemFromDomain(
  item: z.infer<typeof volunteerSignupSchema>,
) {
  return {
    ...volunteerSignupCollectionKeys(item.eventId, item.shiftId, item.id),
    ...item,
  };
}

export function volunteerSignupIdLookupFromDomain(item: z.infer<typeof volunteerSignupSchema>) {
  return {
    ...volunteerSignupIdLookupKeys(item.id),
    id: item.id,
    eventId: item.eventId,
    shiftId: item.shiftId,
    type: item.type,
  };
}

export function volunteerTokenMainKeys(id: string) {
  return mainKeys("volunteerToken", id);
}

export function volunteerTokenItemFromDomain(item: z.infer<typeof volunteerTokenSchema>) {
  return { ...volunteerTokenMainKeys(item.id), ...item };
}

export function apiKeyMainKeys(id: string) {
  return mainKeys("apiKey", id);
}

export function apiKeyGsi1(createdAt: string) {
  return { gsi1pk: "apiKey", gsi1sk: createdAt };
}

export function apiKeyItemFromDomain(item: z.infer<typeof apiKeySchema>) {
  return {
    ...apiKeyMainKeys(item.id),
    ...apiKeyGsi1(item.createdAt),
    ...item,
  };
}

export function publicSnapshotKeys(section: PublicSnapshotSection) {
  return { pk: `publicSnapshot#${section}`, sk: "publicSnapshot" };
}

export function publicSnapshotItemFromDomain(item: z.infer<typeof publicSnapshotSchema>) {
  return { ...publicSnapshotKeys(item.section), ...item };
}
