/**
 * Scheduled Lambda that proactively syncs Behold Instagram posts to DynamoDB.
 *
 * Runs hourly during German daytime hours (7:00–21:00 UTC = 8–22h CET / 9–23h CEST) to keep
 * the cache fresh without consuming Behold's 1200 views/month free-tier limit
 * (~15 runs/day, ~465 calls/month ≈ 39% of the free-tier limit).
 *
 * The webapp route reads exclusively from DynamoDB — no live Behold API calls
 * happen on the main request path.
 *
 * DDB key scheme (social table):
 *   PK: `social#behold`
 *   SK: `feed`
 */

import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import middy from "@middy/core";
import type { EventBridgeEvent } from "aws-lambda";
import dayjs from "dayjs";
import { createBeholdFeedRepository } from "@/lib/social/behold-feed";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { BeholdFeedSchema, BeholdSyncLambdaEnvironmentSchema, type BeholdPost } from "./types";

const { logger, tracer } = createLambdaResources("behold-sync");
const docClient = createDynamoDocClient(tracer);

const env = parseLambdaEnv(BeholdSyncLambdaEnvironmentSchema);
const TABLE_NAME = env.SOCIAL_TABLE_NAME;
const feedRepository = createBeholdFeedRepository(docClient, TABLE_NAME);

const MAX_POSTS = 2;
const MAX_AGE_DAYS = 14;
const BEHOLD_TIMEOUT_MS = 10_000;

/** 3 months — DDB hygiene TTL to eventually reclaim storage */
const DDB_TTL_SECONDS = 90 * 24 * 60 * 60;

const lambdaHandler = async (event: EventBridgeEvent<string, unknown>) => {
  logger.info("Starting Behold Instagram feed sync", { event });
  Sentry.addBreadcrumb({ category: "sync", message: "Starting Behold feed sync", level: "info" });

  const response = await fetch(env.BEHOLD_FEED_URL, {
    signal: AbortSignal.timeout(BEHOLD_TIMEOUT_MS),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    const contentType = response.headers.get("content-type") ?? "unknown";
    const msg = `Behold feed returned ${response.status}`;
    logger.warn(msg, {
      status: response.status,
      contentType,
    });
    Sentry.captureException(new Error(msg), {
      extra: {
        status: response.status,
        contentType,
        responseBody,
      },
    });
    Sentry.captureMessage(msg, "warning");
    return { statusCode: response.status, body: msg };
  }

  const contentType = response.headers.get("content-type") ?? "unknown";
  const responseBody = await response.text();
  let raw: unknown;

  try {
    raw = JSON.parse(responseBody);
  } catch (error) {
    const msg = "Failed to parse Behold feed JSON";
    logger.error(msg, {
      status: response.status,
      contentType,
      error,
    });
    Sentry.captureException(error, {
      extra: {
        status: response.status,
        contentType,
        responseBody,
      },
    });
    return { statusCode: 500, body: msg };
  }

  const parsed = BeholdFeedSchema.safeParse(raw);

  if (!parsed.success) {
    const msg = "Failed to parse Behold feed response";
    const firstIssue = parsed.error.issues[0];

    logger.error(msg, {
      issueCount: parsed.error.issues.length,
      firstIssuePath: firstIssue?.path.join("."),
      firstIssueMessage: firstIssue?.message,
      contentType,
    });
    Sentry.captureException(new Error(msg), {
      extra: {
        issueCount: parsed.error.issues.length,
        firstIssuePath: firstIssue?.path.join("."),
        firstIssueMessage: firstIssue?.message,
        zodError: parsed.error,
        contentType,
        responseBody,
      },
    });
    return { statusCode: 500, body: msg };
  }

  const cutoff = dayjs().subtract(MAX_AGE_DAYS, "day");
  const posts: BeholdPost[] = parsed.data.posts
    .filter((post) => dayjs(post.timestamp).isAfter(cutoff))
    .slice(0, MAX_POSTS);

  await feedRepository.writePosts(posts, DDB_TTL_SECONDS);

  logger.info("Behold feed synced successfully", { postCount: posts.length });
  Sentry.setMeasurement("behold_sync.posts_written", posts.length, "none");

  return {
    statusCode: 200,
    body: JSON.stringify({ postCount: posts.length }),
  };
};

export const handler = Sentry.wrapHandler(
  middy(lambdaHandler).use(injectLambdaContext(logger)).use(captureLambdaHandler(tracer)),
);
