# SAMS match loading: club-scoped projections and cache-peek SSR

The website loads league matches from DynamoDB schedule projections written by the
`sams-provider` event processor (`getSamsMatchesFn` in `app/src/server/functions/sams.ts`).
The live ticker remains a proxy to `backend.sams-ticker.de`. There is no SAMS REST
client (`sams-rest-v2`) on the read path.

**Decision:** Serve matches and rankings from provider projections only. Scope to
configured clubs (VC Müllheim and Markgräfler Volleys), prefer the season UUID stored
on projected teams, apply `past`/`future` filtering in application code with
`hasResult`, and use cache-peek loaders (`loadSamsMatchesForSsrFn`) for SSR so
navigation never blocks on a live SAMS API call.

## Club filter

When no `league`, `sportsclub`, or `team` parameter is passed, matches are loaded for
all sportsclubs configured in `project.config.ts`.

Their `sportsclubUuid` values are resolved from the SAMS DynamoDB table (club
projections). Schedule rows are read per club/season and merged.

When a `team` filter is set (team detail pages), only matches whose `team1` or
`team2` UUID matches are kept.

## Season filter

Season scoping is best-effort:

1. Read `seasonUuid` from projected teams in DynamoDB (`getAllSamsTeams()`).
   When teams disagree, use the season UUID held by the **majority** of teams;
   on a tie, prefer the **most recently updated** team's season. Log a warning when
   multiple distinct season UUIDs are present.
2. Load that club/season schedule projection.
3. If season resolution fails (missing table, processor not seeded, dev environment),
   return an empty match list rather than calling an external API.

We use the **projected** season from club-season team events, not a live
`currentSeason` flag from SAMS.

## Post-fetch filtering

Projections are the full rolling window for a club/season; additional filtering
happens in memory:

| Parameter         | Effect                                             |
| ----------------- | -------------------------------------------------- |
| `range: "future"` | Keep matches with `hasResult === false` (unplayed) |
| `range: "past"`   | Keep matches with `hasResult === true` (completed) |
| `limit: N`        | Slice to N results after filtering                 |

Stored matches are provider `Match` objects (`team1` / `team2` / `result` /
`hasResult`). `team1` is the home / first-listed side.

## SSR loading strategy

Route loaders must not call `getSamsMatchesFn` directly when a peek helper exists.
Use cache-peek loaders so navigation stays on DynamoDB.

| Route                 | Loader                                              | Client refresh                                   |
| --------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `/termine`            | `loadSamsMatchesForSsrFn({ range: "future" })`      | `useSamsMatches(hookOptions)`                    |
| `/tabelle`            | `loadSamsMatchesForSsrFn({ range: "past", limit })` | `useSamsMatches(hookOptions)`                    |
| `/teams/$slug`        | `loadSamsMatchesForSsrFn({ team })`                 | `useSamsMatches(hookOptions)`                    |
| Homepage (Heimspiele) | none                                                | `useSamsMatches({ range: "future", limit: 50 })` |

Loaders receive `hookOptions` from the server function and pass them to
`useSamsMatches`. Do not call `getSamsMatchesFn` in loaders.

React Query passes cached loader data as `initialData` and refetches in the background
when stale. `useSamsMatches` uses a **5 minute** `staleTime`.

The ICS calendar at `/ics/$teamSlug` is a TanStack Start **server route**
(`server.handlers.GET` only). Importing `*.server.ts` there is allowed.

## Per-page behaviour

| Page                  | Projection filters               | Post-filter                                      |
| --------------------- | -------------------------------- | ------------------------------------------------ |
| Homepage (Heimspiele) | 2 clubs + season (if resolved)   | `future`, `limit: 50`, then home games (`team1`) |
| `/termine`            | same                             | `future`                                         |
| `/tabelle`            | same                             | `past`, dynamic `limit`                          |
| Team page             | team UUID + season (if resolved) | all matches for that team                        |

Missing rankings return an empty settled payload (`teams: []`), not an error.

## Considered options

- **Live** `currentSeason` **from SAMS API** — more accurate during season transitions, but
  reintroduces REST dependency. Rejected; projected season is the source of truth.
- **SSR-blocking** `getSamsMatchesFn` **in loaders** — simpler code, but caused Lambda duration
  alarms when the path still hit SAMS. Rejected for public routes.
- **HAL `_embedded` / `results` adapter** — mapped provider matches back to the old REST DTO.
  Rejected; store and serve provider `Match`.

## Consequences

- Match data may be empty early in a new season if projected teams still reference the old
  `seasonUuid` and the provider has not published a new club-season schedule.
- Rankings and matches are only as fresh as the last processed provider event.
- Club logos are stored as the provider `logoUrl` (`logoImageLink`) and served
  through the same-origin `/api/sams/logos` proxy (CloudFront-cached). They are
  not copied to S3.
