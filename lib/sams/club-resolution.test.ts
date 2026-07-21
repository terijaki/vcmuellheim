import { describe, expect, it } from "vite-plus/test";
import {
  filterConfiguredSamsClubs,
  findMissingConfiguredClubSlugs,
} from "@/lib/sams/club-resolution";

describe("findMissingConfiguredClubSlugs", () => {
  it("returns slugs with no matching club record", () => {
    const missing = findMissingConfiguredClubSlugs([
      { nameSlug: "vc-muellheim", sportsclubUuid: "uuid-a" },
    ]);
    expect(missing).toContain("markgraefler-volleys");
    expect(missing).not.toContain("vc-muellheim");
  });
});

describe("filterConfiguredSamsClubs", () => {
  it("keeps only configured target clubs with a sportsclub UUID", () => {
    const filtered = filterConfiguredSamsClubs([
      { nameSlug: "vc-muellheim", sportsclubUuid: "uuid-a", name: "VC Müllheim" },
      { nameSlug: "other-club", sportsclubUuid: "uuid-b", name: "Other" },
      { nameSlug: "markgraefler-volleys", sportsclubUuid: "uuid-c", name: "Markgräfler Volleys" },
    ]);

    expect(filtered.map((c) => c.nameSlug).sort()).toEqual([
      "markgraefler-volleys",
      "vc-muellheim",
    ]);
  });
});
