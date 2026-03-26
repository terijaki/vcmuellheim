# SAMS API — Data Model & Relationships

SAMS is the league management system used by German volleyball associations. This document explains how the API resources relate to each other and the patterns needed to query them effectively.

Full endpoint reference: `https://www.volleyball-baden.de/api/v2/swagger.json`

---

## Resource Hierarchy

```
Association  (e.g. SBVV)
└── Sportsclub  (e.g. VC Müllheim)
    └── Team  ── registered in a League for a Season

Season  (e.g. 2025/26)
└── League  (e.g. Verbandsliga Herren)
    ├── Teams  (leaf nodes — one entry per sportsclub per league)
    ├── Rankings  (computed standing table for the league)
    └── Match-days  (ordered rounds)
        └── League-matches  (individual games, two teams each)
```

**Seasons** and **Associations** are independent top-level resources. A **League** is the intersection: it belongs to exactly one Season and one Association.

A **Team** is a club's registered entry in a specific League for a Season. One physical club (Sportsclub) can have multiple teams across different leagues (e.g. VC Müllheim 1 in Herren + VC Müllheim 1 in Damen Süd + VC Müllheim 2 in Damen Mitte). Teams also have a `masterTeamUuid` field — if set, the team is a sub-entry (reserve/youth entry sharing a parent); filter these out with `select(.masterTeamUuid == null)` when you only want the primary team registrations.

---

## Key Resources & How to Navigate Them

### Seasons

```
GET /seasons
GET /seasons/{uuid}
```

Returns all competition periods as a **bare array** (not a paginated envelope). The current season is identified by `currentSeason: true` (not `isCurrent`). Always resolve the current season UUID first — it is required as a filter for leagues.

```bash
sams.ts seasons | jq '.[] | select(.currentSeason == true)'
```

### Associations

```
GET /associations
GET /associations/{uuid}
GET /associations/{uuid}/sportsclubs
```

Top-level organisational units — in this project the relevant one is SBVV (`2b7571b5-f985-c552-ea1c-f819ed3811c1`).

> **Known upstream bug:** SBVV does not appear in the paginated `GET /associations` list, but is accessible directly by UUID. This is a confirmed API issue (reported 2025-11-27). Always use the UUID directly.

Sportsclubs are paged under `associations/{uuid}/sportsclubs` — paginate with `size=100` and increment `page` until `last == true`.

### Leagues

```
GET /leagues
GET /leagues/{uuid}
GET /leagues/{uuid}/teams
GET /leagues/{uuid}/rankings
GET /leagues/{uuid}/match-days
```

Leagues belong to a **Season** (`seasonUuid`) and an **Association** (`associationUuid`). Filter by both when looking for VC Müllheim's active leagues:

```bash
sams.ts leagues \
  --query association=2b7571b5-f985-c552-ea1c-f819ed3811c1 \
  --query size=100 | \
  jq '[.content[] | select(.seasonUuid == "fde078d8-b9d5-4202-be3d-5c2614cc8d95")]'
```

Then scan `leagues/{uuid}/teams` for each league to find VC Müllheim's sportsclub UUID.

### Teams

```
GET /leagues/{uuid}/teams
GET /teams/{uuid}
```

A Team object has:

```json
{
	"uuid": "...",
	"name": "VC Müllheim 1",
	"sportsclubUuid": "9c8b0252-c19b-4e83-a564-202e90d75c01",
	"masterTeamUuid": null // null = primary team; non-null = sub-team
}
```

> **Note:** `leagueUuid` is **not** a field on `TeamDto` — it is not returned even when fetching via `leagues/{uuid}/teams`. Retain the league UUID from the request URL.

Filter primary teams with `select(.masterTeamUuid == null)`.

### Rankings

```
GET /leagues/{uuid}/rankings
```

Returns a ranked list of teams in the league. Useful fields:

```json
{
	"uuid": "c2ddea7c-b7ec-4172-aa85-4d9c47aba362",
	"rank": 5,
	"teamName": "VC Müllheim 1",
	"points": 21,
	"wins": 6,
	"losses": 9,
	"setWins": 27,
	"setLosses": 31,
	"matchesPlayed": 15,
	"ballWins": 100,
	"ballLosses": 92
}
```

> **Note:** The team identifier field is `uuid` (not `teamUuid`). Stats use `wins`/`losses`/`setWins`/`setLosses` — not `matchesWon`/`matchesLost`/`setsWon`/`setsLost`.

### Match-days & League-matches

```
GET /leagues/{uuid}/match-days
GET /match-days/{uuid}/league-matches
```

**Match-days** are the ordered rounds of a league (e.g. "5. Spieltag"). The date field is named `matchdate` (per `LeagueMatchDayDto`) and is populated with the round date. Individual match entries also carry their own `date` and `time` fields.

**League-matches** are the actual games. Each match object has:

```json
{
	"date": "2026-03-07",
	"time": "14:00",
	"team1Description": "TV Merdingen 2",
	"team2Description": "VC Müllheim 1",
	"results": null,
	"_embedded": {
		"team1": { "uuid": "..." },
		"team2": { "uuid": "f41dd752-07b0-42e8-afe2-4662a81eadf9" }
	}
}
```

For played matches, `results` is an object with `winner`, `winnerName`, `setPoints`, `ballPoints`, and a `sets` array. For future matches it is `null`.

> **Note:** The top-level `GET /league-matches` endpoint supports filtering via `for-league`, `for-season`, `for-sportsclub`, and `for-team` query parameters (not `leagueUuid`). For league-scoped queries the `leagues/{uuid}/match-days` → `match-days/{md-uuid}/league-matches` path is still preferable as it avoids paginating through the full historical dataset.

Pattern for upcoming matches for a specific team:

```bash
for md in <match-day-uuid-1> <match-day-uuid-2>; do
  bun run .github/skills/sams-api/sams.ts match-days $md league-matches | \
    jq '[.content[] | select(.date >= "2026-02-22") |
         select(._embedded.team1.uuid == "<team-uuid>" or
                ._embedded.team2.uuid == "<team-uuid>") |
         {date, time, home: .team1Description, guest: .team2Description}] |
        select(length > 0)'
done
```

---

## Pagination Pattern

Most list endpoints return a paginated envelope:

```json
{
  "content": [...],
  "totalPages": 6,
  "totalElements": 103,
  "number": 0,
  "last": false
}
```

Control with `--query size=100 --query page=0` (zero-indexed). Keep incrementing `page` until `last == true`.

**Exception:** `GET /seasons` returns a **bare array** — use `.[]` not `.content[]`.

**jq tip:** for all paged endpoints access items with `.content[]`, never `.[]`.

---

## HAL+JSON & Embedded Resources

The API returns `application/hal+json`. Related resources are often embedded under `_embedded`:

```json
"_embedded": {
  "team1": { "uuid": "...", "name": "..." },
  "team2": { "uuid": "...", "name": "..." }
}
```

Use `Accept: */*` when making requests — `Accept: application/json` causes HTTP 406.

---

## Known UUIDs (season 2025/26)

| Resource    | Name                                        | UUID                                   |
| ----------- | ------------------------------------------- | -------------------------------------- |
| Season      | 2025/26 (current)                           | `fde078d8-b9d5-4202-be3d-5c2614cc8d95` |
| Association | Südbadischer Volleyball-Verband (SBVV)      | `2b7571b5-f985-c552-ea1c-f819ed3811c1` |
| Sportsclub  | VC Müllheim                                 | `9c8b0252-c19b-4e83-a564-202e90d75c01` |
| League      | Verbandsliga Herren                         | `2000b48f-eec8-4927-beb1-c4568069ebec` |
| League      | Bezirksklasse Damen Süd                     | `a35b26d6-e212-4903-a529-2315642c7723` |
| League      | Bezirksklasse Damen Mitte                   | `235406bb-0f96-4a1c-b631-e5abd8261808` |
| Team        | VC Müllheim 1 (Herren / Verbandsliga)       | `c2ddea7c-b7ec-4172-aa85-4d9c47aba362` |
| Team        | VC Müllheim 1 (Damen / Bezirksklasse Süd)   | `f41dd752-07b0-42e8-afe2-4662a81eadf9` |
| Team        | VC Müllheim 2 (Damen / Bezirksklasse Mitte) | `88a52416-15f6-4dbc-b5d6-8d38a2bef737` |

---

## Quirks & Gotchas

| Issue                                   | Detail                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------- |
| SBVV missing from `/associations` list  | Confirmed upstream API bug. Use UUID directly.                                   |
| Match-day date field is `matchdate`     | Named `matchdate` (not `date`) per `LeagueMatchDayDto`.                          |
| `/league-matches` filter params         | Use `for-league`, `for-season`, `for-sportsclub`, `for-team` — not `leagueUuid`. |
| `GET /seasons` returns a bare array     | Use `.[]` not `.content[]` — no pagination envelope.                             |
| Rankings team identifier is `uuid`      | Not `teamUuid` — stat fields are `wins`/`losses`/`setWins`/`setLosses`.          |
| Match results field is `results`        | Plural — `results` is an object for played matches, `null` for future ones.      |
| `Accept: application/json` → HTTP 406   | API returns `hal+json`. Use `Accept: */*`.                                       |
| Sub-teams have `masterTeamUuid` set     | Filter with `select(.masterTeamUuid == null)` for primary teams only.            |
| Current season field is `currentSeason` | Not `isCurrent` or `isActive`.                                                   |
