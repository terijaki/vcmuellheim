import { buildSamsMatchesHookOptions } from "@webapp/utils/sams-ssr";
import { peekSamsMatches, type SamsMatchesInput } from "./sams/match-loader";

/** Peek-only SSR loader bundle — DynamoDB read, never blocks on SAMS API. */
export async function handleLoadSamsMatchesForSsr(input?: SamsMatchesInput) {
  const cached = await peekSamsMatches(input);
  return {
    cached: cached ?? undefined,
    hookOptions: buildSamsMatchesHookOptions(input ?? {}, cached),
  };
}
