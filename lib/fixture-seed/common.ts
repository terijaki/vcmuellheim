import https from "node:https";
import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import {
  BatchWriteCommand,
  type DynamoDBDocumentClient,
  ScanCommand as ScanDocCommand,
} from "@aws-sdk/lib-dynamodb";
import { type createDb } from "@/lib/db/electrodb-client";
import { type LocationInput, type MemberInput, type TeamInput } from "@/lib/db/schemas";
import { invokeImageProcessorAsync } from "@/lib/media/image-processing";

export interface SeedContext {
  cdkEnvironment: string;
  s3Bucket: string;
  contentTableName: string;
  entities: ReturnType<typeof createDb>;
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
  entity: { create(item: T): { go(): Promise<unknown> } },
  items: T[],
): Promise<void> {
  await Promise.all(items.map((item) => entity.create(item).go()));
}

export async function uploadImageToS3(
  ctx: SeedContext,
  imageUrl: string,
  s3Key: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(imageUrl, async (response) => {
        if (
          response.statusCode === 301 ||
          response.statusCode === 302 ||
          response.statusCode === 303 ||
          response.statusCode === 307 ||
          response.statusCode === 308
        ) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            response.resume();
            resolve(await uploadImageToS3(ctx, redirectUrl, s3Key));
            return;
          }

          response.resume();
          reject(new Error(`HTTP ${response.statusCode}: Missing redirect location header`));
          return;
        }

        if (response.statusCode && response.statusCode >= 400) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(chunk);
        });

        response.on("end", async () => {
          try {
            const imageBuffer = Buffer.concat(chunks);
            if (imageBuffer.length === 0) {
              reject(new Error("Downloaded image is empty"));
              return;
            }

            const command = new PutObjectCommand({
              Bucket: ctx.s3Bucket,
              Key: s3Key,
              Body: imageBuffer,
              ContentType: response.headers["content-type"] || "image/jpeg",
            });

            await ctx.s3Client.send(command);
            console.log(
              `  ✓ Uploaded image to s3://${ctx.s3Bucket}/${s3Key} (${imageBuffer.length} bytes)`,
            );
            await invokeImageProcessorAsync(ctx.s3Bucket, s3Key);
            resolve(s3Key);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}
