import dayjs from "dayjs";
import type { LeagueMatchesResponse } from "@/lambda/sams/types";
import type { SamsMatchesInput } from "@utils/sams-matches";

export type { SamsMatchesInput };

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
    initialDataUpdatedAt: cached?.timestamp ? dayjs(cached.timestamp).valueOf() : undefined,
  };
}
