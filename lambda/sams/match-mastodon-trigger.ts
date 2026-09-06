/**
 * Claim newly concluded matches and async-invoke Mastodon share for pending claims.
 */

import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import type { Logger } from "@aws-lambda-powertools/logger";
import type { Match } from "sams-provider-events";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  createMatchMastodonShareRepository,
  type MatchMastodonShareRepository,
} from "@/lib/social/match-mastodon-share";
import type { MastodonMatchShareRequest } from "@/lambda/social/mastodon-share";
import { findNewlyConcludedMatches, type MatchForConclusion } from "./match-conclusion";

export type MatchMastodonTriggerDeps = {
  environment: string;
  socialTableName?: string;
  mastodonLambdaName?: string;
  documentClient: DynamoDBDocumentClient;
  lambdaClient?: LambdaClient;
  shareRepository?: MatchMastodonShareRepository;
  invokeMatchShare?: (payload: MastodonMatchShareRequest) => Promise<void>;
  logger: Pick<Logger, "info" | "warn" | "error">;
};
function isProd(environment: string): boolean {
  return environment === "prod";
}

function resolveShareRepository(
  deps: MatchMastodonTriggerDeps,
): MatchMastodonShareRepository | null {
  if (deps.shareRepository) return deps.shareRepository;
  if (!deps.socialTableName) return null;
  return createMatchMastodonShareRepository(deps.documentClient, deps.socialTableName);
}

async function defaultInvoke(
  deps: MatchMastodonTriggerDeps,
  payload: MastodonMatchShareRequest,
): Promise<void> {
  if (deps.invokeMatchShare) {
    await deps.invokeMatchShare(payload);
    return;
  }
  if (!deps.mastodonLambdaName) {
    throw new Error("MASTODON_LAMBDA_NAME is not configured");
  }
  const lambdaClient = deps.lambdaClient ?? new LambdaClient({});
  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: deps.mastodonLambdaName,
      InvocationType: "Event",
      Payload: JSON.stringify(payload),
    }),
  );
}

/**
 * Claim share ledger rows for newly concluded matches (prod only).
 * Conditional-check failures are ignored (already claimed).
 */
export async function claimNewlyConcludedMatchShares(
  previousMatches: readonly MatchForConclusion[],
  incomingMatches: readonly Match[],
  configuredSportsclubUuids: ReadonlySet<string>,
  deps: MatchMastodonTriggerDeps,
): Promise<void> {
  if (!isProd(deps.environment)) {
    deps.logger.info("Skipping match Mastodon claim - not in production environment");
    return;
  }

  const shareRepo = resolveShareRepository(deps);
  if (!shareRepo) {
    deps.logger.warn("Skipping match Mastodon claim - SOCIAL_TABLE_NAME not configured");
    return;
  }

  const newlyConcluded = findNewlyConcludedMatches(
    previousMatches,
    incomingMatches,
    configuredSportsclubUuids,
  );

  for (const match of newlyConcluded) {
    const claimed = await shareRepo.claim(match.uuid);
    deps.logger.info("Match Mastodon share claim", {
      matchUuid: match.uuid,
      claimed,
    });
  }
}

/**
 * Async-invoke Mastodon share for event match UUIDs that still have a pending claim.
 */
export async function invokePendingMatchMastodonShares(
  incomingMatches: readonly Match[],
  configuredSportsclubUuids: ReadonlySet<string>,
  deps: MatchMastodonTriggerDeps,
): Promise<void> {
  if (!isProd(deps.environment)) {
    deps.logger.info("Skipping match Mastodon invoke - not in production environment");
    return;
  }

  const shareRepo = resolveShareRepository(deps);
  if (!shareRepo || !deps.mastodonLambdaName) {
    deps.logger.warn("Skipping match Mastodon invoke - share wiring not configured");
    return;
  }

  const configuredList = [...configuredSportsclubUuids];
  const seen = new Set<string>();

  for (const match of incomingMatches) {
    if (seen.has(match.uuid)) continue;
    seen.add(match.uuid);

    const record = await shareRepo.get(match.uuid);
    if (record?.status !== "pending") continue;

    const payload: MastodonMatchShareRequest = {
      match,
      configuredSportsclubUuids: configuredList,
    };

    try {
      await defaultInvoke(deps, payload);
      deps.logger.info("Invoked Mastodon share for pending match claim", {
        matchUuid: match.uuid,
      });
    } catch (error) {
      deps.logger.error("Failed to invoke Mastodon share for match", {
        matchUuid: match.uuid,
        error,
      });
      throw error;
    }
  }
}
