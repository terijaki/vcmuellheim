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

| Route               | Loader                                     | Client refresh                |
| ------------------- | ------------------------------------------ | ----------------------------- |
| `/termine`          | `getCurrentTermineFn({ range: "future" })` | `useSamsMatches(hookOptions)` |
| `/tabelle`          | `getCurrentTabelleFn` + past Termine       | `useSamsMatches(hookOptions)` |
| `/teams/$slug`      | `loadSamsMatchesForSsrFn({ team })`        | `useSamsMatches(hookOptions)` |
| Homepage (sections) | deferred `loadHomePageSections()`          | same hooks with `initialData` |

React Query passes cached loader data as `initialData` and refetches in the background
when stale. `useSamsMatches` uses a **5 minute** `staleTime`.

The homepage loader awaits only the intro image. Each section is an unresolved promise
rendered with `<Await>` and its own fallback, so the route does not wait for every read.
The hero is shorter than a full viewport so the first fallback is on screen.
Nitro uses the AWS Lambda **streaming** handler; the function URL uses **RESPONSE_STREAM**
(not buffered). Anonymous `GET /` sends `Cache-Control` with `s-maxage=600` and
`stale-while-revalidate` so CloudFront can serve HTML between sparse visits. Signed-in
requests are `private, no-store`. Root `beforeLoad` skips `getSessionFn` when no session
cookie is present.

The homepage does not filter 50 future matches in the browser. SAMS sync writes a
Heimspiele card document (`META#heimspiele`) with league name, opponent, hall, and
team UUIDs. The 14-day window and the four date-location cap are applied when that
document is read, because the window depends on the current day. Content sections
(events, news, sponsors, public members) are separate documents on the content table,
rewritten when those records are saved and again at the end of feature-branch fixture
seed. Reads return an empty section when the snapshot is missing. There is no schema
migration of source items.

The ICS calendar at `/ics/$teamSlug` is a TanStack Start **server route**
(`server.handlers.GET` only). Importing `*.server.ts` there is allowed.

## Consequences

- After deploy, application read models populate on the next SAMS provider event (or
  `db:seed:sams` in non-prod). Until then, Tabelle/Termine may be empty.
- Canonical SAMS projections are retained; historical seasons stay queryable via
  season-keyed app datasets.
- Rankings and matches are only as fresh as the last processed provider event that
  triggered an application projection rebuild.
