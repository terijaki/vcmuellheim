/**
 * Reset and seed the content table, then rewrite homepage snapshots.
 * Invoked only from the feature-branch seed route.
 */

import { db } from "@/lib/db/electrodb-client";
import { docClient } from "@/lib/db/client";
import { getContentTableName } from "@/lib/db/env";
import { rebuildAllPublicSnapshots } from "@/lib/read-models/public-snapshots";
import { S3Client } from "@aws-sdk/client-s3";
import { cleanupDatabase, type SeedContext } from "@/scripts/seed/common";
import { seedBusData } from "@/scripts/seed/bus";
import { seedEventsData } from "@/scripts/seed/events";
import { seedLocationsData } from "@/scripts/seed/locations";
import { seedMembersData } from "@/scripts/seed/members";
import { seedNewsData } from "@/scripts/seed/news";
import { seedSponsorsData } from "@/scripts/seed/sponsors";
import { seedTeamsData } from "@/scripts/seed/teams";
import { seedVolunteerEventsData } from "@/scripts/seed/volunteer-events";

function createDeployedSeedContext(): SeedContext {
  const cdkEnvironment = process.env.CDK_ENVIRONMENT || "dev";
  if (cdkEnvironment === "prod") {
    throw new Error("Cannot seed production environment");
  }
  const s3Bucket = process.env.MEDIA_BUCKET_NAME;
  if (!s3Bucket) {
    throw new Error("MEDIA_BUCKET_NAME is not set");
  }

  return {
    cdkEnvironment,
    s3Bucket,
    contentTableName: getContentTableName(),
    entities: db(),
    docClient,
    s3Client: new S3Client({ region: process.env.AWS_REGION || "eu-central-1" }),
    locationCache: [],
    membersCache: [],
    teamCache: [],
  };
}

export async function runFixtureSeed(): Promise<void> {
  const ctx = createDeployedSeedContext();
  await cleanupDatabase(ctx);
  await seedLocationsData(ctx);
  await seedMembersData(ctx);
  await seedTeamsData(ctx);
  await seedNewsData(ctx);
  await seedSponsorsData(ctx);
  await seedEventsData(ctx);
  await seedVolunteerEventsData(ctx);
  await seedBusData(ctx);
  await rebuildAllPublicSnapshots();
}
