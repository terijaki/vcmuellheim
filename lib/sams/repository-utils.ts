import dayjs from "dayjs";
import { z } from "zod";

/** Club metadata TTL (logo/name rows). */
export const SAMS_CLUB_TTL_DAYS = 30;
/** Teams, rosters, schedules, and rankings. */
export const SAMS_PROJECTION_TTL_DAYS = 365;
/** Ops metadata from provider sync.completed events. */
export const SAMS_OPS_TTL_DAYS = 90;

export function unixTtlSecondsFromNow(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
}

export function isoTimestampNow(): string {
  return dayjs().toISOString();
}

export function withTimestamps<T extends Record<string, unknown>>(
  item: T,
): T & { createdAt: string; updatedAt: string } {
  const now = isoTimestampNow();
  return {
    ...item,
    createdAt: now,
    updatedAt: now,
  };
}

export function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(message, { cause: error });
    }
    throw error;
  }
}
