import type { LeagueMatchesResponse } from "@/lambda/sams/types";

export type SamsMatchesInput = {
  league?: string;
  season?: string;
  sportsclub?: string;
  team?: string;
  limit?: number;
  range?: "past" | "future";
};

export type SamsMatchesHookOptions = SamsMatchesInput & {
  initialData?: LeagueMatchesResponse;
  initialDataUpdatedAt?: number;
};

/** Bundles peek cache data for useSamsMatches — client-safe, no server imports. */
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
