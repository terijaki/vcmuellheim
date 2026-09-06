import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { parseSamsEventFromSqsBody, SamsEventType } from "sams-provider-events";
import type { SamsRepositories } from "@/lib/sams/repositories/create-sams-repositories";
import {
  buildMockSamsProviderSqsBody,
  SEED_MGV_CLUB,
  SEED_MGV_TEAMS,
  SEED_SEASON,
  SEED_VCM_CLUB,
  samsProviderEventFixtures,
} from "@/fixtures/sams-provider-events";
import { processSamsProviderEvent, processSamsProviderSqsBody } from "./sams-provider-events";

function createMockRepos(): SamsRepositories {
  return {
    clubs: {
      getById: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
      queryByNameSlugPrefix: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      listAll: vi.fn().mockResolvedValue([]),
      getByNameSlug: vi.fn().mockResolvedValue(null),
      upsertMany: vi.fn().mockResolvedValue(undefined),
    },
    teams: {
      listAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      getByNameSlug: vi.fn().mockResolvedValue(null),
      queryByNameSlugPrefix: vi.fn().mockResolvedValue([]),
      upsertMany: vi.fn().mockResolvedValue(undefined),
    },
    rosters: {
      upsert: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      getByTeamUuid: vi.fn().mockResolvedValue(null),
    },
    schedules: {
      get: vi.fn().mockResolvedValue(null),
      getSnapshotVersion: vi.fn().mockResolvedValue(undefined),
      replace: vi.fn().mockResolvedValue(undefined),
      mergeMatchesForClub: vi.fn().mockResolvedValue(undefined),
      listMatchesForSportsclubs: vi.fn().mockResolvedValue([]),
    },
    rankings: {
      get: vi.fn().mockResolvedValue(null),
      replace: vi.fn().mockResolvedValue(undefined),
    },
  } satisfies SamsRepositories;
}

describe("processSamsProviderSqsBody", () => {
  it("parses EventBridge-wrapped SQS bodies", async () => {
    const repos = createMockRepos();
    const fixture = samsProviderEventFixtures.find(
      (entry) => entry.type === SamsEventType.clubUpdated,
    );
    expect(fixture).toBeDefined();

    await processSamsProviderSqsBody(buildMockSamsProviderSqsBody(fixture!), repos);
    expect(repos.clubs.upsert).toHaveBeenCalledOnce();
  });
});

describe("processSamsProviderEvent", () => {
  let repos: SamsRepositories;

  beforeEach(() => {
    repos = createMockRepos();
  });

  it("upserts club-season teams and removes stale teams only for the same club and season", async () => {
    repos.teams.listAll = vi.fn().mockResolvedValue([
      {
        uuid: "stale-team-mgv",
        sportsclubUuid: SEED_MGV_CLUB.uuid,
        seasonUuid: SEED_SEASON.uuid,
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      {
        uuid: "keep-other-season",
        sportsclubUuid: SEED_MGV_CLUB.uuid,
        seasonUuid: "other-season",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      {
        uuid: "keep-other-club",
        sportsclubUuid: SEED_VCM_CLUB.uuid,
        seasonUuid: SEED_SEASON.uuid,
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
    ]);

    const fixture = samsProviderEventFixtures.find(
      (entry) =>
        entry.type === SamsEventType.clubSeasonTeamsUpdated &&
        (entry.payload as { club?: { uuid?: string } }).club?.uuid === SEED_MGV_CLUB.uuid,
    );
    expect(fixture).toBeDefined();

    const event = parseSamsEventFromSqsBody(buildMockSamsProviderSqsBody(fixture!));
    await processSamsProviderEvent(event, repos);

    expect(repos.teams.delete).toHaveBeenCalledWith("stale-team-mgv");
    expect(repos.teams.delete).not.toHaveBeenCalledWith("keep-other-season");
    expect(repos.teams.delete).not.toHaveBeenCalledWith("keep-other-club");
    expect(repos.teams.upsert).toHaveBeenCalled();
    const upsertedUuids = vi.mocked(repos.teams.upsert).mock.calls.map((call) => call[0].uuid);
    expect(upsertedUuids).toContain(SEED_MGV_TEAMS[0].uuid);
  });

  it("upserts club-season rosters", async () => {
    const fixture = samsProviderEventFixtures.find(
      (entry) => entry.type === SamsEventType.clubSeasonRostersUpdated,
    );
    expect(fixture).toBeDefined();

    const event = parseSamsEventFromSqsBody(buildMockSamsProviderSqsBody(fixture!));
    await processSamsProviderEvent(event, repos);

    expect(repos.rosters.upsert).toHaveBeenCalled();
    const firstUpsert = vi.mocked(repos.rosters.upsert).mock.calls[0]?.[0];
    expect(firstUpsert?.players.length).toBeGreaterThan(0);
  });

  it("replaces league ranking projections", async () => {
    const fixture = samsProviderEventFixtures.find(
      (entry) => entry.type === SamsEventType.leagueRankingUpdated,
    );
    expect(fixture).toBeDefined();

    const event = parseSamsEventFromSqsBody(buildMockSamsProviderSqsBody(fixture!));
    await processSamsProviderEvent(event, repos);

    expect(repos.rankings.replace).toHaveBeenCalledOnce();
    const rankingInput = vi.mocked(repos.rankings.replace).mock.calls[0]?.[0];
    expect(rankingInput?.teams.some((team) => team.logoUrl)).toBe(true);
  });

  it("skips ranking replace when snapshotVersion is unchanged", async () => {
    const fixture = samsProviderEventFixtures.find(
      (entry) => entry.type === SamsEventType.leagueRankingUpdated,
    );
    expect(fixture).toBeDefined();
    const event = parseSamsEventFromSqsBody(buildMockSamsProviderSqsBody(fixture!));
    repos.rankings.get = vi.fn().mockResolvedValue({ snapshotVersion: event.snapshotVersion });

    await processSamsProviderEvent(event, repos);

    expect(repos.rankings.replace).not.toHaveBeenCalled();
  });

  it("replaces club match schedule projections with provider Match shape", async () => {
    const fixture = samsProviderEventFixtures.find(
      (entry) => entry.type === SamsEventType.clubMatchScheduleUpdated,
    );
    expect(fixture).toBeDefined();

    const event = parseSamsEventFromSqsBody(buildMockSamsProviderSqsBody(fixture!));
    await processSamsProviderEvent(event, repos);

    expect(repos.schedules.replace).toHaveBeenCalledOnce();
    const scheduleInput = vi.mocked(repos.schedules.replace).mock.calls[0]?.[0];
    expect(scheduleInput?.matches.length).toBeGreaterThan(0);
    const firstMatch = scheduleInput?.matches[0];
    expect(firstMatch?.team1.uuid).toBeTruthy();
    expect(firstMatch?.team2.uuid).toBeTruthy();
    expect(typeof firstMatch?.hasResult).toBe("boolean");
  });

  it("skips schedule replace when snapshotVersion is unchanged", async () => {
    const fixture = samsProviderEventFixtures.find(
      (entry) => entry.type === SamsEventType.clubMatchScheduleUpdated,
    );
    expect(fixture).toBeDefined();
    const event = parseSamsEventFromSqsBody(buildMockSamsProviderSqsBody(fixture!));
    repos.schedules.get = vi.fn().mockResolvedValue({
      snapshotVersion: event.snapshotVersion,
      matches: [],
    });

    await processSamsProviderEvent(event, repos);

    expect(repos.schedules.replace).not.toHaveBeenCalled();
  });

  it("merges match-block updates even when the schedule snapshotVersion matches", async () => {
    const scheduleFixture = samsProviderEventFixtures.find(
      (entry) => entry.type === SamsEventType.clubMatchScheduleUpdated,
    );
    expect(scheduleFixture).toBeDefined();
    const scheduleEvent = parseSamsEventFromSqsBody(buildMockSamsProviderSqsBody(scheduleFixture!));
    if (scheduleEvent.type !== SamsEventType.clubMatchScheduleUpdated) {
      throw new Error("expected club match schedule fixture");
    }

    const match = scheduleEvent.payload.matches[0];
    expect(match).toBeDefined();
    repos.schedules.getSnapshotVersion = vi.fn().mockResolvedValue(scheduleEvent.snapshotVersion);

    await processSamsProviderEvent(
      parseSamsEventFromSqsBody(
        JSON.stringify({
          detail: {
            schemaVersion: "1.0.0",
            eventId: "evt-match-block",
            occurredAt: "2026-08-27T12:00:00.000Z",
            source: "sams-provider",
            type: SamsEventType.matchBlockUpdated,
            sourceSyncId: "sync-block",
            snapshotVersion: scheduleEvent.snapshotVersion,
            payload: {
              matchBlockId: "block-1",
              leagueUuid: match.leagueUuid ?? "league",
              date: match.date ?? "2026-08-27",
              refreshState: "active",
              cachedAt: "2026-08-27T12:00:00.000Z",
              nextRefreshAfter: null,
              isStale: false,
              matchUuids: [match.uuid],
              matches: [match],
            },
          },
        }),
      ),
      repos,
    );

    expect(repos.schedules.mergeMatchesForClub).toHaveBeenCalled();
    expect(repos.schedules.replace).not.toHaveBeenCalled();
  });

  it("ignores reserved event types gracefully", async () => {
    await processSamsProviderEvent(
      parseSamsEventFromSqsBody(
        JSON.stringify({
          detail: {
            schemaVersion: "1.0.0",
            eventId: "evt-3",
            occurredAt: "2026-08-27T12:00:00.000Z",
            source: "sams-provider",
            type: SamsEventType.syncFailed,
            sourceSyncId: "sync-3",
            snapshotVersion: "deadbeefdeadbeef",
            payload: { job: "teams-sync", message: "failed" },
          },
        }),
      ),
      repos,
    );

    expect(repos.clubs.upsert).not.toHaveBeenCalled();
    expect(repos.rankings.replace).not.toHaveBeenCalled();
  });

  it("ignores clubsSyncCompleted and teamsSyncCompleted without persisting ops", async () => {
    for (const type of [SamsEventType.clubsSyncCompleted, SamsEventType.teamsSyncCompleted]) {
      await processSamsProviderEvent(
        parseSamsEventFromSqsBody(
          JSON.stringify({
            detail: {
              schemaVersion: "1.0.0",
              eventId: `evt-${type}`,
              occurredAt: "2026-08-27T12:00:00.000Z",
              source: "sams-provider",
              type,
              sourceSyncId: "sync-complete",
              snapshotVersion: "deadbeefdeadbeef",
              payload:
                type === SamsEventType.clubsSyncCompleted
                  ? { associationsInvoked: 1, associationUuids: ["assoc-1"] }
                  : {
                      seasonUuid: SEED_SEASON.uuid,
                      seasonName: SEED_SEASON.name,
                      teamsCount: 1,
                      countsBySportsclubUuid: { [SEED_MGV_CLUB.uuid]: 1 },
                      changedTeamUuids: [SEED_MGV_TEAMS[0].uuid],
                    },
            },
          }),
        ),
        repos,
      );
    }

    expect(repos.clubs.upsert).not.toHaveBeenCalled();
    expect(repos.teams.upsert).not.toHaveBeenCalled();
    expect(repos.schedules.replace).not.toHaveBeenCalled();
    expect(repos.rankings.replace).not.toHaveBeenCalled();
  });

  it("skips club upsert when snapshotVersion is unchanged", async () => {
    const fixture = samsProviderEventFixtures.find(
      (entry) => entry.type === SamsEventType.clubUpdated,
    );
    expect(fixture).toBeDefined();
    const event = parseSamsEventFromSqsBody(buildMockSamsProviderSqsBody(fixture!));
    repos.clubs.getById = vi.fn().mockResolvedValue({ snapshotVersion: event.snapshotVersion });

    await processSamsProviderEvent(event, repos);

    expect(repos.clubs.upsert).not.toHaveBeenCalled();
  });

  it("does not claim or invoke Mastodon share outside prod", async () => {
    const claim = vi.fn().mockResolvedValue(true);
    const getShare = vi.fn();
    const invokeShare = vi.fn();

    const previousMatch = {
      uuid: "match-conclude-1",
      hasResult: false,
      seasonUuid: SEED_SEASON.uuid,
      team1: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: SEED_VCM_CLUB.uuid },
      team2: { uuid: "t2", name: "TV Foo", sportsclubUuid: "other" },
    };
    const concludedMatch = {
      ...previousMatch,
      hasResult: true,
      result: { winner: "t1", setPoints: "3:0" },
    };

    repos.clubs.listAll = vi.fn().mockResolvedValue([
      {
        sportsclubUuid: SEED_VCM_CLUB.uuid,
        nameSlug: SEED_VCM_CLUB.slug,
        name: SEED_VCM_CLUB.name,
      },
    ]);
    repos.schedules.get = vi.fn().mockResolvedValue({
      snapshotVersion: "old",
      matches: [previousMatch],
    });

    await processSamsProviderEvent(
      {
        schemaVersion: "1.0.0",
        eventId: "evt-share-dev",
        occurredAt: "2026-09-01T12:00:00.000Z",
        source: "sams-provider",
        type: SamsEventType.clubMatchScheduleUpdated,
        sourceSyncId: "sync-share",
        snapshotVersion: "new",
        payload: {
          club: {
            uuid: SEED_VCM_CLUB.uuid,
            name: SEED_VCM_CLUB.name,
            slug: SEED_VCM_CLUB.slug,
            logoUrl: null,
          },
          season: { ...SEED_SEASON, current: true },
          matches: [concludedMatch],
          projectedAt: "2026-09-01T12:00:00.000Z",
          cachedAt: "2026-09-01T12:00:00.000Z",
          isStale: false,
        },
      },
      repos,
      {
        environment: "dev",
        socialTableName: "social",
        mastodonLambdaName: "mastodon-share",
        documentClient: {} as never,
        shareRepository: { claim, get: getShare, markPosted: vi.fn() } as never,
        invokeMatchShare: invokeShare,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    );

    expect(claim).not.toHaveBeenCalled();
    expect(invokeShare).not.toHaveBeenCalled();
    expect(repos.schedules.replace).toHaveBeenCalledOnce();
  });

  it("claims and invokes Mastodon share once per newly concluded match in prod", async () => {
    const claim = vi.fn().mockResolvedValue(true);
    const getShare = vi.fn().mockResolvedValue({ status: "pending" });
    const invokeShare = vi.fn().mockResolvedValue(undefined);

    const previousMatch = {
      uuid: "match-conclude-2",
      hasResult: false,
      seasonUuid: SEED_SEASON.uuid,
      team1: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: SEED_VCM_CLUB.uuid },
      team2: { uuid: "t2", name: "TV Foo", sportsclubUuid: "other" },
    };
    const concludedMatch = {
      ...previousMatch,
      hasResult: true,
      result: { winner: "t1", setPoints: "3:1" },
    };

    repos.clubs.listAll = vi.fn().mockResolvedValue([
      {
        sportsclubUuid: SEED_VCM_CLUB.uuid,
        nameSlug: SEED_VCM_CLUB.slug,
        name: SEED_VCM_CLUB.name,
      },
    ]);
    repos.schedules.get = vi.fn().mockResolvedValue({
      snapshotVersion: "old",
      matches: [previousMatch],
    });

    await processSamsProviderEvent(
      {
        schemaVersion: "1.0.0",
        eventId: "evt-share-prod",
        occurredAt: "2026-09-01T12:00:00.000Z",
        source: "sams-provider",
        type: SamsEventType.clubMatchScheduleUpdated,
        sourceSyncId: "sync-share-prod",
        snapshotVersion: "new",
        payload: {
          club: {
            uuid: SEED_VCM_CLUB.uuid,
            name: SEED_VCM_CLUB.name,
            slug: SEED_VCM_CLUB.slug,
            logoUrl: null,
          },
          season: { ...SEED_SEASON, current: true },
          matches: [concludedMatch],
          projectedAt: "2026-09-01T12:00:00.000Z",
          cachedAt: "2026-09-01T12:00:00.000Z",
          isStale: false,
        },
      },
      repos,
      {
        environment: "prod",
        socialTableName: "social",
        mastodonLambdaName: "mastodon-share",
        documentClient: {} as never,
        shareRepository: { claim, get: getShare, markPosted: vi.fn() } as never,
        invokeMatchShare: invokeShare,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    );

    expect(claim).toHaveBeenCalledWith("match-conclude-2");
    expect(invokeShare).toHaveBeenCalledOnce();
    expect(invokeShare.mock.calls[0]?.[0].match.uuid).toBe("match-conclude-2");
    expect(repos.schedules.replace).toHaveBeenCalledOnce();
  });

  it("invokes pending claims on retry even when the projection already has hasResult", async () => {
    const claim = vi.fn().mockResolvedValue(false);
    const getShare = vi.fn().mockResolvedValue({ status: "pending" });
    const invokeShare = vi.fn().mockResolvedValue(undefined);

    const concludedMatch = {
      uuid: "match-retry-1",
      hasResult: true,
      seasonUuid: SEED_SEASON.uuid,
      team1: { uuid: "t1", name: "VC Müllheim 1", sportsclubUuid: SEED_VCM_CLUB.uuid },
      team2: { uuid: "t2", name: "TV Foo", sportsclubUuid: "other" },
      result: { winner: "t1", setPoints: "3:0" },
    };

    repos.clubs.listAll = vi.fn().mockResolvedValue([
      {
        sportsclubUuid: SEED_VCM_CLUB.uuid,
        nameSlug: SEED_VCM_CLUB.slug,
        name: SEED_VCM_CLUB.name,
      },
    ]);
    repos.schedules.get = vi.fn().mockResolvedValue({
      snapshotVersion: "same",
      matches: [concludedMatch],
    });

    await processSamsProviderEvent(
      {
        schemaVersion: "1.0.0",
        eventId: "evt-share-retry",
        occurredAt: "2026-09-01T12:00:00.000Z",
        source: "sams-provider",
        type: SamsEventType.clubMatchScheduleUpdated,
        sourceSyncId: "sync-share-retry",
        snapshotVersion: "same",
        payload: {
          club: {
            uuid: SEED_VCM_CLUB.uuid,
            name: SEED_VCM_CLUB.name,
            slug: SEED_VCM_CLUB.slug,
            logoUrl: null,
          },
          season: { ...SEED_SEASON, current: true },
          matches: [concludedMatch],
          projectedAt: "2026-09-01T12:00:00.000Z",
          cachedAt: "2026-09-01T12:00:00.000Z",
          isStale: false,
        },
      },
      repos,
      {
        environment: "prod",
        socialTableName: "social",
        mastodonLambdaName: "mastodon-share",
        documentClient: {} as never,
        shareRepository: { claim, get: getShare, markPosted: vi.fn() } as never,
        invokeMatchShare: invokeShare,
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      },
    );

    expect(claim).not.toHaveBeenCalled();
    expect(invokeShare).toHaveBeenCalledOnce();
    expect(repos.schedules.replace).not.toHaveBeenCalled();
  });
});
