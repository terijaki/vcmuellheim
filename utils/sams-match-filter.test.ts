import { describe, expect, it } from "vite-plus/test";
import { filterAndSortSamsMatches } from "@/utils/sams-match-filter";

describe("filterAndSortSamsMatches", () => {
  const matches = [
    { uuid: "1", date: "2026-01-10", hasResult: true },
    { uuid: "2", date: "2026-01-05", hasResult: true },
    { uuid: "3", date: "2026-02-01", hasResult: false },
    { uuid: "4", date: "2026-01-20", hasResult: false },
  ];

  it("keeps completed matches newest-first for past range", () => {
    const result = filterAndSortSamsMatches(matches, { range: "past" });
    expect(result.map((m) => m.uuid)).toEqual(["1", "2"]);
  });

  it("keeps unplayed matches oldest-first for future range", () => {
    const result = filterAndSortSamsMatches(matches, { range: "future" });
    expect(result.map((m) => m.uuid)).toEqual(["4", "3"]);
  });

  it("applies limit after range filtering", () => {
    const result = filterAndSortSamsMatches(matches, { range: "future", limit: 1 });
    expect(result).toHaveLength(1);
    expect(result[0]?.uuid).toBe("4");
  });
});
