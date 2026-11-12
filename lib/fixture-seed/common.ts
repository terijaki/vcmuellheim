import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import {
  BatchWriteCommand,
  type DynamoDBDocumentClient,
  ScanCommand as ScanDocCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  busRepository,
  eventRepository,
  locationRepository,
  sponsorRepository,
  volunteerEventRepository,
  volunteerSignupRepository,
} from "@/lib/db/repositories/content-entities-repository";
import { memberRepository } from "@/lib/db/repositories/member-repository";
import { newsRepository } from "@/lib/db/repositories/news-repository";
import { teamRepository } from "@/lib/db/repositories/team-repository";
import { type LocationInput, type MemberInput, type TeamInput } from "@/lib/db/schemas";
import { invokeImageProcessorAsync } from "@/lib/media/image-processing";
import { type SeedAssetFileName, readSeedAssetBytes } from "./seed-assets";

export const seedEntityWriters = {
  news: newsRepository,
  member: memberRepository,
  event: eventRepository,
  team: teamRepository,
  sponsor: sponsorRepository,
  location: locationRepository,
  bus: busRepository,
  volunteerEvent: volunteerEventRepository,
  volunteerSignup: volunteerSignupRepository,
} as const;

export type SeedEntityWriters = typeof seedEntityWriters;

export interface SeedContext {
  cdkEnvironment: string;
  s3Bucket: string;
  contentTableName: string;
  socialTableName: string;
  entities: SeedEntityWriters;
  docClient: DynamoDBDocumentClient;
  s3Client: S3Client;
  locationCache: LocationInput[];
  membersCache: MemberInput[];
  teamCache: TeamInput[];
}

export async function cleanupDatabase(ctx: SeedContext): Promise<void> {
  if (ctx.cdkEnvironment === "prod") {
    throw new Error("Cannot cleanup production environment");
  }

  console.log("\n🧹 Cleaning up database...");

  try {
    let scannedItems = 0;
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    while (true) {
      const result = await ctx.docClient.send(
        new ScanDocCommand({
          TableName: ctx.contentTableName,
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      if (!result.Items || result.Items.length === 0) {
        break;
      }

      const deleteRequests = result.Items.map((item: Record<string, unknown>) => ({
        DeleteRequest: {
          Key: { pk: item.pk, sk: item.sk },
        },
      }));

      const batchSize = 25;
      for (let i = 0; i < deleteRequests.length; i += batchSize) {
        const batch = deleteRequests.slice(i, i + batchSize);
        const command = new BatchWriteCommand({
          RequestItems: {
            [ctx.contentTableName]: batch,
          },
        });
        await ctx.docClient.send(command);
        scannedItems += batch.length;
      }

      lastEvaluatedKey = result.LastEvaluatedKey;
      if (!lastEvaluatedKey) {
        break;
      }
    }

    if (scannedItems > 0) {
      console.log(`  ✓ Deleted ${scannedItems} items from ${ctx.contentTableName}`);
    } else {
      console.log(`  • ${ctx.contentTableName}: empty`);
    }
  } catch (error) {
    const errorMsg = (error as Error).message || "";
    if (!errorMsg.includes("ResourceNotFoundException")) {
      console.warn(`  ⚠️  Error cleaning ${ctx.contentTableName}:`, error);
    }
  }

  console.log("✅ Database cleanup completed");
}

export async function putItems<T>(
  entity: { create(item: T): Promise<unknown> },
  items: T[],
): Promise<void> {
  await Promise.all(items.map((item) => entity.create(item)));
}

export async function uploadSeedAssetToS3(
  ctx: SeedContext,
  assetFileName: SeedAssetFileName,
  s3Key: string,
): Promise<string> {
  const imageBuffer = await readSeedAssetBytes(assetFileName);
  if (imageBuffer.length === 0) {
    throw new Error(`Seed asset is empty: ${assetFileName}`);
  }

  const command = new PutObjectCommand({
    Bucket: ctx.s3Bucket,
    Key: s3Key,
    Body: imageBuffer,
    ContentType: "image/jpeg",
  });

  await ctx.s3Client.send(command);
  console.log(`  ✓ Uploaded image to s3://${ctx.s3Bucket}/${s3Key} (${imageBuffer.length} bytes)`);
  await invokeImageProcessorAsync(ctx.s3Bucket, s3Key);
  return s3Key;
}
