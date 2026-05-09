import dayjs from "dayjs";

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
