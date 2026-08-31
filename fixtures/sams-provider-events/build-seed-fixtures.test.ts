import { describe, expect, it } from "vite-plus/test";
import { parseSamsEventFromSqsBody, SamsEventType } from "sams-provider-events";
import {
  buildMockSamsProviderSqsBody,
  buildSamsProviderSeedFixtures,
  buildTestSamsProviderFixtures,
  SEED_MGV_CLUB,
  SEED_MGV_TEAMS,
  SEED_TARGET_CLUBS,
  SEED_VCM_CLUB,
  SEED_VCM_TEAMS,
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

    expect(fixtures.some((fixture) => fixture.type === SamsEventType.clubsSyncCompleted)).toBe(
      false,
    );
    expect(fixtures.some((fixture) => fixture.type === SamsEventType.teamsSyncCompleted)).toBe(
      false,
    );
  });

  it("parses every seed fixture with the provider event schema", () => {
    const fixtures = buildSamsProviderSeedFixtures({ variationSeed: "fixture-test" });
    for (const fixture of fixtures) {
      expect(() => parseSamsEventFromSqsBody(buildMockSamsProviderSqsBody(fixture))).not.toThrow();
    }
  });

  it("includes VC Müllheim and Markgräfler Volleys club ids", () => {
    const fixtures = buildTestSamsProviderFixtures();
    const clubUuids = fixtures
      .filter((fixture) => fixture.type === SamsEventType.clubUpdated)
      .map((fixture) => fixture.payload.uuid);

    expect(clubUuids).toContain(SEED_VCM_CLUB.uuid);
    expect(clubUuids).toContain(SEED_MGV_CLUB.uuid);
  });

  it("uses canonical short club name plus optional team number, not variation-dependent labels", () => {
    const allowedNames = [...SEED_VCM_TEAMS, ...SEED_MGV_TEAMS].map((team) => team.name);
    for (const variationSeed of ["seed-a", "seed-b"]) {
      const fixtures = buildSamsProviderSeedFixtures({ variationSeed });
      const teamNames = fixtures
        .filter((fixture) => fixture.type === SamsEventType.clubSeasonTeamsUpdated)
        .flatMap((fixture) =>
          (fixture.payload.teams as Array<{ name: string }>).map((team) => team.name),
        );
      expect(teamNames.length).toBeGreaterThan(0);
      for (const name of teamNames) {
        expect(allowedNames).toContain(name);
      }
    }
  });

  it("uses short club name plus optional team number 1-4, never league or gender", () => {
    const fixtures = buildSamsProviderSeedFixtures({ variationSeed: "names-test" });
    const teamNames: string[] = [];
    for (const fixture of fixtures) {
      if (fixture.type === SamsEventType.clubSeasonTeamsUpdated) {
        for (const team of fixture.payload.teams as Array<{ name: string }>) {
          teamNames.push(team.name);
        }
      }
      if (fixture.type === SamsEventType.leagueRankingUpdated) {
        for (const entry of fixture.payload.entries as Array<{ teamName: string }>) {
          teamNames.push(entry.teamName);
        }
      }
    }

    expect(teamNames.length).toBeGreaterThan(0);
    for (const name of teamNames) {
      expect(name).not.toMatch(/Herren|Damen|Mix|U\d+|Landesliga|Verbandsliga|Bezirksliga/i);
      expect(name).toMatch(/^(?:.+?)(?: [1-4])?$/);
    }
  });

  it("uses obvious 90s-cartoon opponent club names", () => {
    const fixtures = buildSamsProviderSeedFixtures({ variationSeed: "names-test" });
    const clubNames = fixtures
      .filter((fixture) => fixture.type === SamsEventType.clubUpdated)
      .map((fixture) => fixture.payload.name as string);

    expect(clubNames).toEqual(
      expect.arrayContaining([
        "Mighty Ducks",
        "Animaniacs",
        "Rugrats United",
        "Dexter Lab",
        "Pinky & Brain",
        "Hey Arnold VC",
        "Gargoyles",
        "Ninja Turtles",
        "Team Rocket",
        "Johnny Bravo",
      ]),
    );
  });

  it("uses picsum club logos and omits logoUrl for some clubs so the UI fallback can be tested", () => {
    const fixtures = buildSamsProviderSeedFixtures({ variationSeed: "logo-test" });
    const clubLogos = fixtures
      .filter((fixture) => fixture.type === SamsEventType.clubUpdated)
      .map((fixture) => fixture.payload.logoUrl as string | null);
    const rankingLogos = fixtures
      .filter((fixture) => fixture.type === SamsEventType.leagueRankingUpdated)
      .flatMap((fixture) =>
        (fixture.payload.entries as Array<{ logoUrl?: string }>).map((entry) => entry.logoUrl),
      );

    const withLogo = [...clubLogos, ...rankingLogos].filter(
      (logo): logo is string => typeof logo === "string",
    );
    const withoutLogo = [...clubLogos, ...rankingLogos].filter((logo) => logo == null);

    expect(withLogo.length).toBeGreaterThan(0);
    expect(withoutLogo.length).toBeGreaterThan(0);
    for (const logo of withLogo) {
      expect(logo).toContain("picsum.photos/seed/");
    }
  });
});
