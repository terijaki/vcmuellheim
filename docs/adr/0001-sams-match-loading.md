# SAMS match loading: application read models at write time

The website loads league matches and standings from **application read models**
(`apptabelle` / `apptermine`) written by the `sams-provider` event processor when
canonical SAMS projections change. Canonical club/season schedules and league/season
rankings remain in DynamoDB for history and specialized queries. The live ticker
remains a proxy to `backend.sams-ticker.de`. There is no SAMS REST client
(`sams-rest-v2`) on the read path.

**Decision:** Prepare Tabelle and Termine data at SAMS sync/write time. Public
`/tabelle` and `/termine` reads use `getCurrentTabelle` / `getCurrentTermine` (or
equivalent thin accessors) — a single Query against the `current` dataset — without
resolving season, configured clubs, or league membership at request time.

## Club filter

Configured clubs (VC Müllheim and Markgräfler Volleys from `project.config.ts`) are
resolved during projection rebuild and baked into the Termine/Tabelle read models.
Request-time loaders do not call `getAllSamsClubs()` for the main page path.

## Season filter

The synced season (majority `seasonUuid` on projected teams) is resolved during
projection rebuild. The `current` dataset always reflects that published season.
Historical copies are also written under `season#<uuid>` partitions. Request-time
page loaders do not rediscover the season.

## Range filtering

Termine rows use SK prefixes `F#` (future / no result) and `P#` (past / has result)
so DynamoDB can query one range with a limit. `team1` remains the home / first-listed
side; `isHomeGame` is stored on each Termine row for Heimspiele filters.

## SSR loading strategy

| Route                 | Loader                                     | Client refresh                                   |
| --------------------- | ------------------------------------------ | ------------------------------------------------ |
| `/termine`            | `getCurrentTermineFn({ range: "future" })` | `useSamsMatches(hookOptions)`                    |
| `/tabelle`            | `getCurrentTabelleFn` + past Termine       | `useSamsMatches(hookOptions)`                    |
| `/teams/$slug`        | `loadSamsMatchesForSsrFn({ team })`        | `useSamsMatches(hookOptions)`                    |
| Homepage (Heimspiele) | none                                       | `useSamsMatches({ range: "future", limit: 50 })` |

React Query passes cached loader data as `initialData` and refetches in the background
when stale. `useSamsMatches` uses a **5 minute** `staleTime`.

The ICS calendar at `/ics/$teamSlug` is a TanStack Start **server route**
(`server.handlers.GET` only). Importing `*.server.ts` there is allowed.

## Consequences

- After deploy, application read models populate on the next SAMS provider event (or
  `db:seed:sams` in non-prod). Until then, Tabelle/Termine may be empty.
- Canonical SAMS projections are retained; historical seasons stay queryable via
  season-keyed app datasets.
- Rankings and matches are only as fresh as the last processed provider event that
  triggered an application projection rebuild.
