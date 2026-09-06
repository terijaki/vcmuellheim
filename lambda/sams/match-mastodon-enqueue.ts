/**
 * Enqueue newly concluded matches for Mastodon sharing (prod only).
 * Social stack owns the queue and posts; this module only SendMessages.
 */

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import type { Logger } from "@aws-lambda-powertools/logger";
import type { Match } from "sams-provider-events";
import type { MastodonMatchShareRequest } from "@/lambda/social/mastodon-share";
import { findNewlyConcludedMatches, type MatchForConclusion } from "./match-conclusion";

export type MatchMastodonEnqueueDeps = {
  environment: string;
  queueUrl?: string;
  sqsClient?: SQSClient;
  sendMatchShare?: (payload: MastodonMatchShareRequest) => Promise<void>;
  logger: Pick<Logger, "info" | "warn" | "error">;
};

function isProd(environment: string): boolean {
  return environment === "prod";
}

async function defaultSend(
  deps: MatchMastodonEnqueueDeps,
  payload: MastodonMatchShareRequest,
): Promise<void> {
  if (deps.sendMatchShare) {
    await deps.sendMatchShare(payload);
    return;
  }
  if (!deps.queueUrl) {
    throw new Error("MATCH_MASTODON_QUEUE_URL is not configured");
  }
  const sqsClient = deps.sqsClient ?? new SQSClient({});
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: deps.queueUrl,
      MessageBody: JSON.stringify(payload),
    }),
  );
}

/**
 * Enqueue newly concluded matches before writing the schedule projection (prod only).
 * Non-prod never sends — Social never receives work to post.
 */
export async function enqueueNewlyConcludedMatchShares(
  previousMatches: readonly MatchForConclusion[],
  incomingMatches: readonly Match[],
  configuredSportsclubUuids: ReadonlySet<string>,
  deps: MatchMastodonEnqueueDeps,
): Promise<void> {
  if (!isProd(deps.environment)) {
    deps.logger.info("Skipping match Mastodon enqueue - not in production environment");
    return;
  }

  if (!deps.queueUrl && !deps.sendMatchShare) {
    deps.logger.warn("Skipping match Mastodon enqueue - MATCH_MASTODON_QUEUE_URL not configured");
    return;
  }

  const newlyConcluded = findNewlyConcludedMatches(
    previousMatches,
    incomingMatches,
    configuredSportsclubUuids,
  );
  const configuredList = [...configuredSportsclubUuids];

  for (const match of newlyConcluded) {
    const payload: MastodonMatchShareRequest = {
      match,
      configuredSportsclubUuids: configuredList,
    };
    try {
      await defaultSend(deps, payload);
      deps.logger.info("Enqueued match Mastodon share", { matchUuid: match.uuid });
    } catch (error) {
      deps.logger.error("Failed to enqueue match Mastodon share", {
        matchUuid: match.uuid,
        error,
      });
      throw error;
    }
  }
}
