import { buildTestSamsProviderFixtures } from "./build-seed-fixtures";

export {
  buildSamsProviderSeedFixtures,
  buildTestSamsProviderFixtures,
  hashVariationSeed,
  resolveMvTeamCount,
  resolveTargetClubTeamCount,
  TEST_VARIATION_SEED,
  type BuildSamsProviderSeedFixturesOptions,
  type SamsProviderFixture,
} from "./build-seed-fixtures";
export { buildMockSamsProviderSqsBody } from "./sqs-body";
export {
  matchUuid,
  opponentTeamUuid,
  playerUuid,
  SEED_CLUB_TEAMS,
  SEED_MGV_CLUB,
  SEED_MGV_TEAMS,
  SEED_OPPONENT_CLUBS,
  SEED_SEASON,
  SEED_TARGET_CLUBS,
  SEED_VCM_CLUB,
  SEED_VCM_TEAMS,
  type SeedTargetClub,
} from "./ids";
export { picsumImageUrl } from "./picsum";

export const samsProviderEventFixtures = buildTestSamsProviderFixtures();
