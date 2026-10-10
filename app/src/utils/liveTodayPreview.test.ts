import dayjs from "dayjs";
import { describe, expect, it } from "vite-plus/test";
import { filterTodaysUpcomingMatches } from "./liveTodayPreview";

const now = dayjs("2026-10-10T13:00:00");

describe("filterTodaysUpcomingMatches", () => {
  it("keeps today's matches and drops other days", () => {
    const result = filterTodaysUpcomingMatches(
      [
        { uuid: "today-a", date: "2026-10-10", time: "14:00" },
        { uuid: "tomorrow", date: "2026-10-11", time: "11:00" },
        { uuid: "yesterday", date: "2026-10-09", time: "12:00" },
      ],
      new Set(),
      now,
    );

    expect(result.map((match) => match.uuid)).toEqual(["today-a"]);
  });

  it("excludes matches already shown in the live ticker", () => {
    const result = filterTodaysUpcomingMatches(
      [
        { uuid: "live-1", date: "2026-10-10", time: "12:30" },
        { uuid: "upcoming", date: "2026-10-10", time: "15:00" },
      ],
      new Set(["live-1"]),
      now,
    );

    expect(result.map((match) => match.uuid)).toEqual(["upcoming"]);
  });

  it("sorts today's matches by date then time", () => {
    const result = filterTodaysUpcomingMatches(
      [
        { uuid: "later", date: "2026-10-10", time: "16:00" },
        { uuid: "earlier", date: "2026-10-10", time: "11:00" },
        { uuid: "mid", date: "2026-10-10", time: "14:00" },
      ],
      new Set(),
      now,
    );

    expect(result.map((match) => match.uuid)).toEqual(["earlier", "mid", "later"]);
  });

  it("skips matches without a valid date", () => {
    const result = filterTodaysUpcomingMatches(
      [
        { uuid: "no-date" },
        { uuid: "bad-date", date: "not-a-date" },
        { uuid: "ok", date: "2026-10-10", time: "12:00" },
      ],
      new Set(),
      now,
    );

    expect(result.map((match) => match.uuid)).toEqual(["ok"]);
  });
});
