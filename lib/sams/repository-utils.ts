import dayjs from "dayjs";
import { z } from "zod";

/** Teams, rosters, schedules, rankings, and club metadata. */
export const SAMS_PROJECTION_TTL_DAYS = 365;
/** Club metadata TTL — same as projections so rare club updates cannot expire rows early. */
export const SAMS_CLUB_TTL_DAYS = SAMS_PROJECTION_TTL_DAYS;

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
