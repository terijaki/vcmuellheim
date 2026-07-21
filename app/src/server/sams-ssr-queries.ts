/**
 * SSR loader helpers for SAMS data — enforce the cache-peek contract so route
 * loaders never accidentally call the blocking SAMS API path.
 *
 * See docs/adr/0001-sams-match-loading.md.
 */

import type { LeagueMatchesResponse, RankingResponse } from "@/lambda/sams/types";
import { peekSamsMatches, type SamsMatchesInput } from "@/lib/sams/match-loader";

export type SamsMatchesHookOptions = SamsMatchesInput & {
  initialData?: LeagueMatchesResponse;
  initialDataUpdatedAt?: number;
};

export function buildSamsMatchesHookOptions(
  input: SamsMatchesInput,
  cached: LeagueMatchesResponse | null | undefined,
): SamsMatchesHookOptions {
  return {
    ...input,
    initialData: cached ?? undefined,
    initialDataUpdatedAt: cached?.timestamp ? new Date(cached.timestamp).getTime() : undefined,
  };
}

/** Peek-only SSR loader bundle — safe for route loaders (DynamoDB only). */
export async function loadSamsMatchesForSsr(input: SamsMatchesInput): Promise<{
  cached: LeagueMatchesResponse | undefined;
  hookOptions: SamsMatchesHookOptions;
}> {
  const cached = await peekSamsMatches(input);
  return {
    cached: cached ?? undefined,
    hookOptions: buildSamsMatchesHookOptions(input, cached),
  };
}

export type SamsRankingHookOptions = {
  leagueUuid: string;
  initialData?: RankingResponse;
  initialDataUpdatedAt?: number;
};

export function buildSamsRankingHookOptions(
  leagueUuid: string,
  cached: RankingResponse | undefined,
): SamsRankingHookOptions {
  return {
    leagueUuid,
    initialData: cached,
    initialDataUpdatedAt: cached?.timestamp ? new Date(cached.timestamp).getTime() : undefined,
  };
}
