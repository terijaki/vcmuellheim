import { describe, expect, it } from "vite-plus/test";
import { SamsEventType } from "sams-provider-events";
import {
  buildSamsProviderSeedFixtures,
  buildTestSamsProviderFixtures,
  SEED_MGV_CLUB,
  SEED_TARGET_CLUBS,
  SEED_VCM_CLUB,
} from "./index";

describe("sams-provider-events fixtures", () => {
  it("builds seed fixtures for both configured target clubs", () => {
    const fixtures = buildSamsProviderSeedFixtures({ variationSeed: "fixture-test" });

    for (const club of SEED_TARGET_CLUBS) {
      expect(
        fixtures.some(
          (fixture) =>
            fixture.type === SamsEventType.clubUpdated && fixture.payload.uuid === club.uuid,
        ),
      ).toBe(true);

      expect(
        fixtures.some(
          (fixture) =>
            fixture.type === SamsEventType.clubSeasonTeamsUpdated &&
            (fixture.payload.club as { uuid: string }).uuid === club.uuid,
        ),
      ).toBe(true);

      expect(
        fixtures.some(
          (fixture) =>
            fixture.type === SamsEventType.clubMatchScheduleUpdated &&
            (fixture.payload.club as { uuid: string }).uuid === club.uuid,
        ),
      ).toBe(true);

      expect(
        fixtures.some(
          (fixture) =>
            fixture.type === SamsEventType.leagueRankingUpdated &&
            (fixture.payload.entries as Array<{ sportsclubUuid: string }>).some(
              (entry) => entry.sportsclubUuid === club.uuid,
            ),
        ),
      ).toBe(true);
    }

    expect(fixtures.some((fixture) => fixture.type === SamsEventType.teamsSyncCompleted)).toBe(
      true,
    );
  });

  it("includes VC Müllheim and Markgräfler Volleys club ids", () => {
    const fixtures = buildTestSamsProviderFixtures();
    const clubUuids = fixtures
      .filter((fixture) => fixture.type === SamsEventType.clubUpdated)
      .map((fixture) => fixture.payload.uuid);

    expect(clubUuids).toContain(SEED_VCM_CLUB.uuid);
    expect(clubUuids).toContain(SEED_MGV_CLUB.uuid);
  });
});
