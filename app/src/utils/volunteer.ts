import dayjs from "dayjs";
import type { VolunteerEvent } from "@/lib/db/types";

export type VolunteerEventGroup = "active" | "past" | "archived";

/**
 * Formats a shift's date/time range as a human-readable German string.
 * - Same-day: "Samstag, 19. April 2025, 10:00 Uhr bis 14:00 Uhr"
 * - Multi-day: "Samstag, 19. April 2025 um 10:00 Uhr – Sonntag, 20. April 2025 um 14:00 Uhr"
 * - No end date: "Samstag, 19. April 2025 um 10:00 Uhr"
 */
export function formatShiftDateRange(startDate: string, endDate?: string | null): string {
  const start = dayjs(startDate);
  const startFormatted = start.format("dddd, D. MMMM YYYY [um] HH:mm [Uhr]");
  if (!endDate) return startFormatted;
  return start.isSame(dayjs(endDate), "day")
    ? `${start.format("dddd, D. MMMM YYYY[,] HH:mm [Uhr]")} bis ${dayjs(endDate).format("HH:mm [Uhr]")}`
    : `${startFormatted} – ${dayjs(endDate).format("dddd, D. MMMM [um] HH:mm [Uhr]")}`;
}

export function sanitizeVolunteerPhoneNumber(value: string | undefined): string | undefined {
  const sanitizedValue = value?.trim().replace(/\s+/g, "");
  if (!sanitizedValue) return undefined;
  return sanitizedValue;
}

export function getVolunteerSignupRoleLabel(
  signup: { assignedRoleId?: string | null },
  roles: Array<{ id: string; label: string }>,
): string {
  if (!signup.assignedRoleId) return "Keine";
  return roles.find((role) => role.id === signup.assignedRoleId)?.label ?? "Gelöscht";
}

export function getVolunteerEventGroup(
  event: Pick<VolunteerEvent, "archivedAt" | "shifts">,
  now: string = new Date().toISOString(),
): VolunteerEventGroup {
  if (event.archivedAt) return "archived";

  const latestShift = [...event.shifts].sort((a, b) =>
    dayjs(b.endDate ?? b.startDate).diff(dayjs(a.endDate ?? a.startDate)),
  )[0];

  if (!latestShift) return "active";

  const latestShiftEnd = latestShift.endDate ?? latestShift.startDate;
  return dayjs(latestShiftEnd).isBefore(now) ? "past" : "active";
}
