/**
 * SQS consumer: claim match share ledger and post concluded matches to Mastodon (prod only).
 */

import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import middy from "@middy/core";
import type { SQSEvent, SQSHandler } from "aws-lambda";
import { z } from "zod";
import { matchProjectionSchema } from "sams-provider-events";
import { createMatchMastodonShareRepository } from "@/lib/social/match-mastodon-share";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { shareMatchToMastodon, type MastodonMatchShareRequest } from "./mastodon-share";
import { MatchMastodonHandlerLambdaEnvironmentSchema } from "./types";

const { logger, tracer } = createLambdaResources("match-mastodon-handler");
const docClient = createDynamoDocClient(tracer);
const env = parseLambdaEnv(MatchMastodonHandlerLambdaEnvironmentSchema);

const SOCIAL_TABLE_NAME = env.SOCIAL_TABLE_NAME;
const ENVIRONMENT = env.CDK_ENVIRONMENT ?? "";

const matchSharePayloadSchema = z.object({
  match: matchProjectionSchema,
  configuredSportsclubUuids: z.array(z.string().min(1)).min(1),
});

function isProd(environment: string): boolean {
  return environment === "prod";
}

export async function processMatchMastodonShareMessage(
  body: string,
  options?: {
    environment?: string;
    socialTableName?: string;
    shareMatch?: (request: MastodonMatchShareRequest) => Promise<unknown>;
  },
): Promise<void> {
  const environment = options?.environment ?? ENVIRONMENT;
  if (!isProd(environment)) {
    logger.info("Skipping match Mastodon share - not in production environment");
    return;
  }

  const parsedJson: unknown = JSON.parse(body);
  const payload = matchSharePayloadSchema.parse(parsedJson);

  const tableName = options?.socialTableName ?? SOCIAL_TABLE_NAME;
  const shareRepo = createMatchMastodonShareRepository(docClient, tableName);

  const existing = await shareRepo.get(payload.match.uuid);
  if (existing?.status === "posted") {
    logger.info("Match already posted to Mastodon - skipping", {
      matchUuid: payload.match.uuid,
    });
    return;
  }

  const claimed = await shareRepo.claim(payload.match.uuid);
  logger.info("Match Mastodon share claim", {
    matchUuid: payload.match.uuid,
    claimed,
  });

  const record = claimed ? { status: "pending" as const } : await shareRepo.get(payload.match.uuid);
  if (record?.status === "posted") {
    logger.info("Match already posted after claim race - skipping", {
      matchUuid: payload.match.uuid,
    });
    return;
  }
  if (record?.status !== "pending") {
    logger.warn("No pending match share claim - skipping post", {
      matchUuid: payload.match.uuid,
      status: record?.status,
    });
    return;
  }

  const shareMatch = options?.shareMatch ?? shareMatchToMastodon;
  await shareMatch({
    match: payload.match,
    configuredSportsclubUuids: payload.configuredSportsclubUuids,
  });
}

const lambdaHandler: SQSHandler = async (event: SQSEvent) => {
  const batchItemFailures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      await processMatchMastodonShareMessage(record.body);
    } catch (error) {
      logger.error("Failed to process match Mastodon SQS record", {
        messageId: record.messageId,
        error,
      });
      Sentry.captureException(error);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};

export const handler = Sentry.wrapHandler(
  middy(lambdaHandler).use(injectLambdaContext(logger)).use(captureLambdaHandler(tracer)),
);
