import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { resolveEffectiveSamsSportsclubUuids } from "@utils/sams";
import { createSamsMatchesCacheKey } from "./sams-match-loader.server";
import { buildLiveMatchesFromRaw, invokeSamsLambdaAsync, resolveClubLogoUrl } from "./sams.server";
import { triggerSamsClubsSyncFn, triggerSamsTeamsSyncFn } from "./sams";

describe("resolveClubLogoUrl", () => {
  const CF = "https://cdn.example.com";

  it("returns CloudFront URL when logoS3Key and cloudfrontUrl are set", () => {
    const result = resolveClubLogoUrl({ logoS3Key: "sams-logos/abc.png" }, CF);
    expect(result).toBe("https://cdn.example.com/sams-logos/abc.png");
  });

  it("falls back to logoImageLink when logoS3Key is absent", () => {
    const result = resolveClubLogoUrl({ logoImageLink: "https://sams.cdn/logo.png" }, CF);
    expect(result).toBe("https://sams.cdn/logo.png");
  });

  it("falls back to logoImageLink when cloudfrontUrl is empty", () => {
    const result = resolveClubLogoUrl(
      { logoS3Key: "sams-logos/abc.png", logoImageLink: "https://sams.cdn/logo.png" },
      "",
    );
    expect(result).toBe("https://sams.cdn/logo.png");
  });

  it("returns null when club has neither logo field", () => {
    const result = resolveClubLogoUrl({}, CF);
    expect(result).toBeNull();
  });

  it("returns null when club is null", () => {
    const result = resolveClubLogoUrl(null, CF);
    expect(result).toBeNull();
  });
});

describe("resolveEffectiveSamsSportsclubUuids", () => {
  it("uses configured defaults when no explicit filter is present", () => {
    expect(resolveEffectiveSamsSportsclubUuids({}, ["club-a", "club-b"])).toEqual([
      "club-a",
      "club-b",
    ]);
  });

  it("keeps explicit sportsclub filters authoritative", () => {
    expect(
      resolveEffectiveSamsSportsclubUuids(
        { sportsclub: "club-explicit", team: "team-a", league: "league-a" },
        ["club-a", "club-b"],
      ),
    ).toEqual(["club-explicit"]);
  });

  it("does not apply defaults when team or league filters are present", () => {
    expect(resolveEffectiveSamsSportsclubUuids({ team: "team-a" }, ["club-a", "club-b"])).toEqual(
      [],
    );
    expect(
      resolveEffectiveSamsSportsclubUuids({ league: "league-a" }, ["club-a", "club-b"]),
    ).toEqual([]);
  });
});

describe("createSamsMatchesCacheKey", () => {
  it("matches the cache key for default and explicit single-club filters", () => {
    const defaultKey = createSamsMatchesCacheKey({ range: "future", limit: 10 }, ["club-a"]);
    const explicitKey = createSamsMatchesCacheKey(
      { sportsclub: "club-a", range: "future", limit: 10 },
      ["club-a"],
    );

    expect(defaultKey).toBe(explicitKey);
  });

  it("normalizes multi-club cache key order", () => {
    const left = createSamsMatchesCacheKey({ range: "future" }, ["club-b", "club-a"]);
    const right = createSamsMatchesCacheKey({ range: "future" }, ["club-a", "club-b"]);

    expect(left).toBe(right);
  });
});

// Minimal raw ticker shape (post-parse defaults applied)
const makeRaw = (
  overrides: {
    matchDays?: {
      date?: string;
      matches: {
        id: string;
        date?: string | number;
        team1: string;
        team2: string;
        teamDescription1?: string;
        teamDescription2?: string;
      }[];
    }[];
    matchStates?: Record<
      string,
      {
        started: boolean;
        finished: boolean;
        setPoints?: { team1: number; team2: number };
        matchSets: { setNumber: number; setScore: { team1: number; team2: number } }[];
      }
    >;
  } = {},
) => ({
  matchDays: overrides.matchDays ?? [],
  matchStates: overrides.matchStates ?? {},
});

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const todayIso = today.toISOString();
const yesterdayIso = yesterday.toISOString();

describe("buildLiveMatchesFromRaw", () => {
  it("returns empty array when there are no matchStates", () => {
    const result = buildLiveMatchesFromRaw(makeRaw());
    expect(result).toHaveLength(0);
  });

  it("filters out matches that are not started", () => {
    const result = buildLiveMatchesFromRaw(
      makeRaw({
        matchDays: [{ matches: [{ id: "m1", team1: "t1", team2: "t2" }] }],
        matchStates: { m1: { started: false, finished: false, matchSets: [] } },
      }),
    );
    expect(result).toHaveLength(0);
  });

  it("filters out started matches with no team metadata", () => {
    const result = buildLiveMatchesFromRaw(
      makeRaw({
        matchStates: { "unknown-match": { started: true, finished: false, matchSets: [] } },
      }),
    );
    expect(result).toHaveLength(0);
  });

  it("includes started matches that have team metadata", () => {
    const result = buildLiveMatchesFromRaw(
      makeRaw({
        matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "t1", team2: "t2" }] }],
        matchStates: { m1: { started: true, finished: false, matchSets: [] } },
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.matchUuid).toBe("m1");
  });

  it("defaults setPoints to 0:0 when absent", () => {
    const result = buildLiveMatchesFromRaw(
      makeRaw({
        matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "t1", team2: "t2" }] }],
        matchStates: { m1: { started: true, finished: false, matchSets: [] } },
      }),
    );
    expect(result[0]?.state.setPoints).toEqual({ team1: 0, team2: 0 });
  });

  it("uses setPoints from state when present", () => {
    const result = buildLiveMatchesFromRaw(
      makeRaw({
        matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "t1", team2: "t2" }] }],
        matchStates: {
          m1: { started: true, finished: false, setPoints: { team1: 2, team2: 1 }, matchSets: [] },
        },
      }),
    );
    expect(result[0]?.state.setPoints).toEqual({ team1: 2, team2: 1 });
  });

  it("uses teamDescription1/2 as names when provided", () => {
    const result = buildLiveMatchesFromRaw(
      makeRaw({
        matchDays: [
          {
            matches: [
              {
                id: "m1",
                date: todayIso,
                team1: "uuid-1",
                team2: "uuid-2",
                teamDescription1: "VC Müllheim",
                teamDescription2: "Other Club",
              },
            ],
          },
        ],
        matchStates: { m1: { started: true, finished: false, matchSets: [] } },
      }),
    );
    expect(result[0]?.team1Name).toBe("VC Müllheim");
    expect(result[0]?.team2Name).toBe("Other Club");
  });

  it("falls back to team UUID as name when teamDescription is absent", () => {
    const result = buildLiveMatchesFromRaw(
      makeRaw({
        matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "uuid-1", team2: "uuid-2" }] }],
        matchStates: { m1: { started: true, finished: false, matchSets: [] } },
      }),
    );
    expect(result[0]?.team1Name).toBe("uuid-1");
    expect(result[0]?.team2Name).toBe("uuid-2");
  });

  it("maps finished state correctly", () => {
    const result = buildLiveMatchesFromRaw(
      makeRaw({
        matchDays: [{ matches: [{ id: "m1", date: todayIso, team1: "t1", team2: "t2" }] }],
        matchStates: {
          m1: { started: true, finished: true, setPoints: { team1: 3, team2: 1 }, matchSets: [] },
        },
      }),
    );
    expect(result[0]?.state.finished).toBe(true);
  });

  it("filters out started matches from previous days", () => {
    const result = buildLiveMatchesFromRaw(
      makeRaw({
        matchDays: [{ matches: [{ id: "m1", date: yesterdayIso, team1: "t1", team2: "t2" }] }],
        matchStates: { m1: { started: true, finished: true, matchSets: [] } },
      }),
    );
    expect(result).toHaveLength(0);
  });

  it("uses matchDay date fallback when match date is missing", () => {
    const result = buildLiveMatchesFromRaw(
      makeRaw({
        matchDays: [{ date: todayIso, matches: [{ id: "m1", team1: "t1", team2: "t2" }] }],
        matchStates: { m1: { started: true, finished: false, matchSets: [] } },
      }),
    );
    expect(result).toHaveLength(1);
  });
});

// ── invokeSamsLambdaAsync ────────────────────────────────────────────────────

const lambdaMock = mockClient(LambdaClient);

describe("invokeSamsLambdaAsync", () => {
  beforeEach(() => {
    lambdaMock.reset();
    process.env.SAMS_CLUBS_SYNC_FUNCTION_NAME = "test-clubs-sync";
    process.env.SAMS_TEAMS_SYNC_FUNCTION_NAME = "test-teams-sync";
  });

  it("resolves without error when StatusCode is 202", async () => {
    lambdaMock.on(InvokeCommand).resolves({ StatusCode: 202 });
    await expect(invokeSamsLambdaAsync("test-fn", "test label")).resolves.toBeUndefined();
  });

  it("throws when StatusCode is not 202", async () => {
    lambdaMock.on(InvokeCommand).resolves({ StatusCode: 500 });
    await expect(invokeSamsLambdaAsync("test-fn", "test label")).rejects.toThrow(
      "test label trigger failed: StatusCode=500",
    );
  });

  it("passes the function name to InvokeCommand", async () => {
    lambdaMock.on(InvokeCommand).resolves({ StatusCode: 202 });
    await invokeSamsLambdaAsync("my-function", "label");
    const calls = lambdaMock.commandCalls(InvokeCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input).toMatchObject({
      FunctionName: "my-function",
      InvocationType: "Event",
    });
  });
});

// ── triggerSamsClubsSyncFn / triggerSamsTeamsSyncFn — admin guard ────────────

describe("triggerSamsClubsSyncFn", () => {
  it("rejects when there is no active admin session (no HTTP request context)", async () => {
    // In a Node.js test environment, requireAdminMiddleware finds no session
    // via getRequest() and throws an authorization error.
    await expect(triggerSamsClubsSyncFn()).rejects.toThrow();
  });
});

describe("triggerSamsTeamsSyncFn", () => {
  it("rejects when there is no active admin session (no HTTP request context)", async () => {
    await expect(triggerSamsTeamsSyncFn()).rejects.toThrow();
  });
});
