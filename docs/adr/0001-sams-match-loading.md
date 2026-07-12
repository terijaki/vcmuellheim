# SAMS match loading: club scope, season filter, and cache-peek SSR

The website loads league matches from the external SAMS API via `getSamsMatchesFn` in
`app/src/server/functions/sams.ts`. Slow, unscoped fetches were triggering production
CloudWatch duration alarms on the webapp Lambda after the new season started.

**Decision:** Load matches scoped to configured clubs, prefer the synced season from
DynamoDB on cache miss, apply `past`/`future` filtering in application code after fetch,
and use cache-peek loaders (`peekSamsMatchesCacheFn`) for SSR so navigation never blocks
on a live SAMS API call.

## Club filter

When no `league`, `sportsclub`, or `team` parameter is passed, matches are fetched for
both sportsclubs configured in `project.config.ts`:

- VC Müllheim
- Markgräfler Volleys

Their `sportsclubUuid` values are resolved from the SAMS DynamoDB table (clubs sync).
The SAMS API is called once per club with `for-sportsclub=<uuid>`, paginated at
`size=100`.

When a `team` filter is set (team detail pages), the default club filter is **not**
applied. Only `for-team=<uuid>` is sent.

## Season filter

Season scoping is best-effort and deferred to the cache-miss path:

1. Try the DynamoDB cache entry without a season key (backward-compatible with older cache).
2. On miss, read `seasonUuid` from synced teams in DynamoDB (`getAllSamsTeams()`).
3. If found, retry cache and API calls with `for-season=<uuid>`.
4. If season resolution fails (missing table, sync not run, dev environment), fall back
   to **all seasons** for the configured clubs.

We intentionally use the **synced** season from the teams sync lambda, not SAMS's live
`currentSeason` flag. If the teams sync is stale (e.g. paused during off-season prep),
match queries may scope to the previous season until the next sync runs.

## Post-fetch filtering

SAMS API filters narrow the download; additional filtering happens in memory:

| Parameter | Effect |
|---|---|
| `range: "future"` | Keep matches without `results.winner` (unplayed) |
| `range: "past"` | Keep matches with `results.winner` (completed) |
| `limit: N` | Slice to N results **after** pagination completes |

`limit` does not reduce SAMS API pagination — all pages matching the API-level filters
are fetched first.

## SSR loading strategy

Route loaders must not call `getSamsMatchesFn` directly. That function may hit the SAMS
API on cache miss and block navigation for several seconds.

| Route | Loader | Client refresh |
|---|---|---|
| `/termine` | `peekSamsMatchesCacheFn({ range: "future" })` | `useSamsMatches({ range: "future" })` |
| `/tabelle` | `peekSamsMatchesCacheFn({ range: "past", limit })` | `useSamsMatches` with `initialData` |
| `/teams/$slug` | `peekSamsMatchesCacheFn({ team })` | `useSamsMatches({ team })` |
| Homepage (Heimspiele) | none | `useSamsMatches({ range: "future", limit: 50 })` |

React Query passes cached loader data as `initialData` and refetches in the background
when stale.

## Per-page behaviour

| Page | SAMS API filters | Post-filter |
|---|---|---|
| Homepage (Heimspiele) | 2 clubs + season (if resolved) | `future`, `limit: 50`, then home-game filter in UI |
| `/termine` | same | `future` |
| `/tabelle` | same | `past`, dynamic `limit` |
| Team page | `for-team` + season (if resolved) | all matches for that team |

## Considered options

- **Live `currentSeason` from SAMS API** — more accurate during season transitions, but
  adds an extra API call on every cache miss. Deferred; synced season is good enough when
  teams sync runs regularly.
- **SSR-blocking `getSamsMatchesFn` in loaders** — simpler code, but caused Lambda duration
  alarms. Rejected for public routes.
- **Pass `limit` to SAMS API** — not supported; pagination always returns full result sets
  for the applied filters.

## Consequences

- Match data may be empty early in a new season if synced teams still reference the old
  `seasonUuid` and the SAMS API has no future matches for that season.
- Cache entries are keyed by resolved params (clubs, season, team, range, limit). A
  season change after teams sync invalidates keys naturally via new `seasonUuid`.
- Production alarms on average Lambda duration should drop once cache-peek loaders are
  deployed and season-scoped fetches replace full-history pagination.
