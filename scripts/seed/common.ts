import "varlock/auto-load";
import { execSync } from "node:child_process";
import https from "node:https";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  ScanCommand as ScanDocCommand,
} from "@aws-sdk/lib-dynamodb";
import { createDb } from "@/lib/db/electrodb-client";
import { type LocationInput, type MemberInput, type TeamInput } from "@/lib/db/schemas";
import { invokeImageProcessorAsync } from "@/lib/media/image-processing";
import { Club } from "@/project.config";
import { getSanitizedBranch } from "@/utils/git";

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

function checkAwsSession(): void {
  try {
    execSync("aws sts get-caller-identity", { stdio: "ignore" });
  } catch {
    console.error(
      "❌ No active AWS session found. Please authenticate via AWS SSO before running this script. See docs/SETUP.md for setup instructions.",
    );
    process.exit(1);
  }
}

export function createSeedContext(): SeedContext {
  const cdkEnvironment = process.env.CDK_ENVIRONMENT || "dev";
  if (cdkEnvironment === "prod") {
    console.error("❌ Cannot seed production environment!");
    console.error("   Set CDK_ENVIRONMENT to 'dev' to seed.");
    process.exit(1);
  }

  console.log(`🌱 Seeding database for environment: ${cdkEnvironment}`);

  checkAwsSession();

  const sanitizedBranch = getSanitizedBranch();
  const branchSuffix = sanitizedBranch ? `-${sanitizedBranch}` : "";
  const contentTableName = `vcm-content-${cdkEnvironment}${branchSuffix}`;
  const s3Bucket = `${Club.slug}-media-${cdkEnvironment}${branchSuffix}`;

  const client = new DynamoDBClient({
    region: process.env.AWS_REGION || "eu-central-1",
  });
  const docClient = DynamoDBDocumentClient.from(client);
  const s3Client = new S3Client({
    region: process.env.AWS_REGION || "eu-central-1",
  });

  return {
    cdkEnvironment,
    s3Bucket,
    contentTableName,
    entities: createDb(docClient, contentTableName),
    docClient,
    s3Client,
    locationCache: [],
    membersCache: [],
    teamCache: [],
  };
}

export async function createCmsUser(ctx: SeedContext, email: string): Promise<void> {
  console.log(`\n👤 Granting Admin role to member: ${email}...`);

  const existing = await ctx.entities.member.query.byPrivateEmail({ privateEmail: email }).go();
  if (existing.data && existing.data.length > 0) {
    const member = existing.data[0];
    if (member.authRole) {
      console.log(`ℹ️  Member ${email} already has authRole: ${member.authRole}`);
      process.exit(0);
    }

    await ctx.entities.member
      .patch({ id: member.id })
      .set({ authRole: "Admin", updatedAt: new Date().toISOString() })
      .go();
    console.log(`✅ Admin role granted to existing member ${email}`);
    console.log(`   The member can now sign in at the CMS with email OTP (passwordless).`);
    return;
  }

  await ctx.entities.member
    .create({
      id: crypto.randomUUID(),
      name: email.split("@")[0],
      privateEmail: email,
      authRole: "Admin",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .go();

  console.log(`✅ Member ${email} created with Admin role`);
  console.log(`   The member can now sign in at the CMS with email OTP (passwordless).`);
}

export async function cleanupDatabase(ctx: SeedContext): Promise<void> {
  if (ctx.cdkEnvironment === "prod") {
    console.error("❌ Cannot cleanup production environment!");
    process.exit(1);
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
