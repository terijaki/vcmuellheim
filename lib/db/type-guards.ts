/**
 * Runtime type guards for content entities.
 */

import type { Bus, Event, Location, Media, Member, News, Sponsor, Team } from "./types";

export function isNews(item: unknown): item is News {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    obj.type === "article" &&
    typeof obj.title === "string" &&
    typeof obj.slug === "string" &&
    typeof obj.content === "string" &&
    (obj.status === "draft" || obj.status === "published" || obj.status === "archived") &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string"
  );
}

export function isEvent(item: unknown): item is Event {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    obj.type === "event" &&
    typeof obj.title === "string" &&
    typeof obj.startDate === "string" &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string"
  );
}

export function isTeam(item: unknown): item is Team {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    obj.type === "team" &&
    typeof obj.name === "string" &&
    typeof obj.slug === "string" &&
    (obj.gender === "male" || obj.gender === "female" || obj.gender === "mixed") &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string"
  );
}

export function isMember(item: unknown): item is Member {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string"
  );
}

export function isMedia(item: unknown): item is Media {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.filename === "string" &&
    typeof obj.mimeType === "string" &&
    typeof obj.url === "string" &&
    typeof obj.s3Key === "string" &&
    typeof obj.s3Bucket === "string" &&
    typeof obj.fileSize === "number" &&
    typeof obj.uploadedBy === "string" &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string"
  );
}

export function isSponsor(item: unknown): item is Sponsor {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string"
  );
}

export function isLocation(item: unknown): item is Location {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.street === "string" &&
    typeof obj.postal === "string" &&
    typeof obj.city === "string" &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string"
  );
}

export function isBus(item: unknown): item is Bus {
  if (!item || typeof item !== "object") return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.driver === "string" &&
    typeof obj.from === "string" &&
    typeof obj.to === "string" &&
    typeof obj.ttl === "number" &&
    typeof obj.createdAt === "string" &&
    typeof obj.updatedAt === "string"
  );
}
