import { describe, expect, it } from "vite-plus/test";
import {
  buildSamsMatchesHookOptions,
  buildSamsRankingHookOptions,
} from "@webapp/server/sams-ssr-queries";

describe("buildSamsMatchesHookOptions", () => {
  it("bundles peek cache data for useSamsMatches", () => {
    const cached = {
      matches: [],
      timestamp: "2026-07-21T08:00:00.000Z",
    };

    const options = buildSamsMatchesHookOptions({ range: "future", limit: 5 }, cached);

    expect(options).toEqual({
      range: "future",
      limit: 5,
      initialData: cached,
      initialDataUpdatedAt: new Date(cached.timestamp).getTime(),
    });
  });

  it("omits initialData when cache is empty", () => {
    expect(buildSamsMatchesHookOptions({ range: "past" }, null)).toEqual({
      range: "past",
      initialData: undefined,
      initialDataUpdatedAt: undefined,
    });
  });
});

describe("buildSamsRankingHookOptions", () => {
  it("bundles peek cache data for ranking hooks", () => {
    const cached = {
      teams: [],
      timestamp: "2026-07-21T08:00:00.000Z",
      leagueUuid: "league-1",
    };

    expect(buildSamsRankingHookOptions("league-1", cached)).toEqual({
      leagueUuid: "league-1",
      initialData: cached,
      initialDataUpdatedAt: new Date(cached.timestamp).getTime(),
    });
  });
});
