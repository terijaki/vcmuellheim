import { describe, expect, it } from "vite-plus/test";
import {
  isClubScheduleWindow,
  mergeClubScheduleProjectionMatches,
} from "@/utils/sams-club-schedule-window";

const now = new Date("2026-09-01T12:00:00.000Z");

describe("isClubScheduleWindow", () => {
  it("includes recent and upcoming dated matches", () => {
    expect(isClubScheduleWindow({ date: "2026-08-25", time: "18:00" }, now)).toBe(true);
    expect(isClubScheduleWindow({ date: "2026-09-10", time: "18:00" }, now)).toBe(true);
  });

  it("excludes matches outside the schedule window", () => {
    expect(isClubScheduleWindow({ date: "2026-07-01", time: "18:00" }, now)).toBe(false);
  });

  it("excludes matches without a date", () => {
    expect(isClubScheduleWindow({ date: undefined }, now)).toBe(false);
  });
});

describe("mergeClubScheduleProjectionMatches", () => {
  it("preserves existing matches outside the provider window and applies incoming in-window rows", () => {
    const historical = {
      uuid: "old-result",
      date: "2026-07-01",
      time: "18:00",
      hasResult: true,
    };
    const droppedInWindow = {
      uuid: "cancelled-future",
      date: "2026-09-05",
      time: "18:00",
      hasResult: false,
    };
    const updated = {
      uuid: "recent",
      date: "2026-08-28",
      time: "19:00",
      hasResult: true,
    };

    const merged = mergeClubScheduleProjectionMatches(
      [historical, droppedInWindow],
      [updated],
      now,
    );

    expect(merged.map((match) => match.uuid).sort()).toEqual(["old-result", "recent"]);
    expect(merged.find((match) => match.uuid === "recent")?.time).toBe("19:00");
  });
});
