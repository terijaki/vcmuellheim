// Dev-only seed: publish mock sams-provider events to the branch-scoped SQS queue.

import "varlock/auto-load";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageBatchCommand, SQSClient } from "@aws-sdk/client-sqs";
import { getSanitizedBranch } from "@/utils/git";
import { computeSamsDataTableName } from "@/lib/db/env";
import { SamsScheduleProjectionRepository } from "@/lib/sams/repositories/sams-schedule-projection-repository";
import { computeSamsProviderEventsQueueName } from "@/lib/sams-provider-env";
import {
  buildMockSamsProviderSqsBody,
  buildSamsProviderSeedFixtures,
  resolveTargetClubTeamCount,
  SEED_OPPONENT_CLUBS,
  SEED_TARGET_CLUBS,
  SEED_SEASON,
} from "@/fixtures/sams-provider-events";

const SQS_BATCH_SIZE = 10;

function countExpectedProjectionItems(variationSeed: string): number {
  let total = SEED_OPPONENT_CLUBS.length;
  for (const club of SEED_TARGET_CLUBS) {
    const teamCount = resolveTargetClubTeamCount(variationSeed, club.uuid);
    total += 1 + 1 + teamCount * 3;
  }
  return total;
}

function checkAwsSession() {
  try {
    execSync("aws sts get-caller-identity", { stdio: "ignore" });
  } catch {
    console.error(
      "❌ No active AWS session found. Authenticate via AWS SSO before running this script. See docs/SETUP.md.",
    );
    process.exit(1);
  }
}

checkAwsSession();

const ENVIRONMENT = process.env.CDK_ENVIRONMENT || "dev";
if (ENVIRONMENT === "prod") {
  console.error("❌ db:seed:sams is dev-only — production receives real provider events.");
  process.exit(1);
}

const BRANCH = getSanitizedBranch();
const REGION = process.env.CDK_REGION || "eu-central-1";
const POLL_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 3_000;

function createSeedDocClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
}

function buildVariationSeed(branch: string): string {
  const runNumber = process.env.GITHUB_RUN_NUMBER?.trim();
  return runNumber ? `${branch}:${runNumber}` : branch || "local";
}

function readQueueUrlFromCdkOutputs(): string | null {
  const outputsPath = resolve(process.cwd(), "cdk-outputs.json");
  try {
    const outputs = JSON.parse(readFileSync(outputsPath, "utf8")) as Record<
      string,
      Record<string, string>
    >;
    for (const stackOutputs of Object.values(outputs)) {
      const url = stackOutputs.SamsProviderEventsQueueUrl;
      if (url && isAwsSqsQueueUrl(url)) return url;
    }
  } catch {
    // Fall through to AWS lookup
  }
  return null;
}

function isAwsSqsQueueUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (!parsed.hostname.endsWith(".amazonaws.com")) return false;
    const pathSegments = parsed.pathname.split("/").filter((segment) => segment.length > 0);
    return pathSegments.length >= 2;
  } catch {
    return false;
  }
}

async function resolveQueueUrlFromAws(queueName: string): Promise<string> {
  const account = execSync("aws sts get-caller-identity --query Account --output text", {
    encoding: "utf8",
  }).trim();
  return `https://sqs.${REGION}.amazonaws.com/${account}/${queueName}`;
}

async function sendMockEvents(
  queueUrl: string,
  fixtures: ReturnType<typeof buildSamsProviderSeedFixtures>,
) {
  const sqs = new SQSClient({ region: REGION });
  const entries = fixtures.map((fixture, index) => ({
    Id: String(index),
    MessageBody: buildMockSamsProviderSqsBody(fixture, `seed-event-${index}`),
  }));

  for (let offset = 0; offset < entries.length; offset += SQS_BATCH_SIZE) {
    const batch = entries.slice(offset, offset + SQS_BATCH_SIZE);
    const result = await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: batch,
      }),
    );

    if (result.Failed?.length) {
      console.error("❌ Failed to send some mock events", result.Failed);
      process.exit(1);
    }
  }

  console.log(`✅ Sent ${entries.length} mock SAMS provider events to ${queueUrl}`);
}

async function waitUntilSeedReady(
  tableName: string,
  deadline: number,
  minProjectionItems: number,
): Promise<boolean> {
  const doc = createSeedDocClient();
  const schedules = new SamsScheduleProjectionRepository(doc, tableName);

  while (Date.now() < deadline) {
    const scan = await doc.send(
      new ScanCommand({
        TableName: tableName,
        Select: "COUNT",
      }),
    );
    const count = scan.Count ?? 0;

    const scheduleChecks = await Promise.all(
      SEED_TARGET_CLUBS.map((club) => schedules.get(club.uuid, SEED_SEASON.uuid)),
    );
    const totalScheduleMatches = scheduleChecks
      .map((schedule) => schedule?.matches.length ?? 0)
      .reduce((sum, value) => sum + value, 0);

    if (count >= minProjectionItems && totalScheduleMatches > 0) {
      console.log(
        `✅ SAMS projections ready in ${tableName} (${count} items, ${totalScheduleMatches} schedule matches)`,
      );
      return true;
    }

    console.log(
      `Waiting for SAMS processor (${count}/${minProjectionItems} items, ${totalScheduleMatches} schedule matches)...`,
    );
    await new Promise((resolveSleep) => setTimeout(resolveSleep, POLL_INTERVAL_MS));
  }

  console.error("❌ Timed out waiting for SAMS projections after seed");
  return false;
}

async function main() {
  const variationSeed = buildVariationSeed(BRANCH);
  const fixtures = buildSamsProviderSeedFixtures({ variationSeed });
  const minProjectionItems = countExpectedProjectionItems(variationSeed);

  const queueName = computeSamsProviderEventsQueueName(ENVIRONMENT, BRANCH);
  const queueUrl = readQueueUrlFromCdkOutputs() ?? (await resolveQueueUrlFromAws(queueName));

  const tableName = computeSamsDataTableName(ENVIRONMENT, BRANCH);
  console.log("=== Seeding SAMS provider mock events ===");
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log(`Branch: ${BRANCH || "(main)"}`);
  console.log(`Variation seed: ${variationSeed}`);
  for (const club of SEED_TARGET_CLUBS) {
    console.log(
      `Active teams (${club.name}): ${resolveTargetClubTeamCount(variationSeed, club.uuid)}`,
    );
  }
  console.log(`Fixture events: ${fixtures.length}`);
  console.log(`Queue: ${queueName}`);
  console.log(`Table: ${tableName}`);

  await sendMockEvents(queueUrl, fixtures);
  const ready = await waitUntilSeedReady(
    tableName,
    Date.now() + POLL_TIMEOUT_MS,
    minProjectionItems,
  );

  if (!ready) {
    process.exit(1);
  }

  console.log("=== SAMS provider seed completed ===");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
