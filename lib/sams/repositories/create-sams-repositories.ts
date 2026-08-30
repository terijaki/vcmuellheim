import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { createSamsClubsRepository, type SamsClubsRepository } from "./sams-clubs-repository";
import {
  createSamsOpsMetadataRepository,
  type SamsOpsMetadataRepository,
} from "./sams-ops-metadata-repository";
import {
  createSamsRankingProjectionRepository,
  type SamsRankingProjectionRepository,
} from "./sams-ranking-projection-repository";
import { createSamsRostersRepository, type SamsRostersRepository } from "./sams-rosters-repository";
import {
  createSamsScheduleProjectionRepository,
  type SamsScheduleProjectionRepository,
} from "./sams-schedule-projection-repository";
import { createSamsTeamsRepository, type SamsTeamsRepository } from "./sams-teams-repository";

export type SamsRepositories = {
  clubs: SamsClubsRepository;
  teams: SamsTeamsRepository;
  rosters: SamsRostersRepository;
  schedules: SamsScheduleProjectionRepository;
  rankings: SamsRankingProjectionRepository;
  ops: SamsOpsMetadataRepository;
};

export function createSamsRepositories(
  client: DynamoDBDocumentClient,
  tableName: string,
): SamsRepositories {
  return {
    clubs: createSamsClubsRepository(client, tableName),
    teams: createSamsTeamsRepository(client, tableName),
    rosters: createSamsRostersRepository(client, tableName),
    schedules: createSamsScheduleProjectionRepository(client, tableName),
    rankings: createSamsRankingProjectionRepository(client, tableName),
    ops: createSamsOpsMetadataRepository(client, tableName),
  };
}
