---
name: sams-api
description: Test and verify the external SAMS REST API at https://www.volleyball-baden.de/api/v2. Use this skill when asked to explore, debug, or verify SAMS API responses — such as listing seasons, fetching rankings, looking up clubs or teams, or checking that the API key is valid. Requires SAMS_API_KEY in .env.local.
argument-hint: "resource [uuid] [subresource] [--query key=value]"
---

# SAMS API Skill

Use this skill to test and verify the SAMS REST API used by this project. All API calls are made by running [sams.ts](./sams.ts) with Bun.

For a full explanation of the data model, resource relationships, pagination patterns, and known quirks, see [API-OVERVIEW.md](./API-OVERVIEW.md).

## Prerequisites

- `SAMS_API_KEY` must be present in `.env.local` (Bun loads it automatically)
- The API base URL is `https://www.volleyball-baden.de/api/v2`
- The API key is sent as the `X-Api-Key` request header
- The API returns `application/hal+json` — use `Accept: */*` (not `application/json`, which causes HTTP 406)

## Response structure

Most list endpoints return a **paginated object**, not a bare array:

```json
{ "content": [...], "totalPages": 6, "totalElements": 103, "last": true }
```

Filter with jq using `.content[]`, not `.[]. `. The current season is identified by `currentSeason: true` (not `isCurrent`). Sub-teams (reserve/youth entries sharing a parent) have a `masterTeamUuid` field set — filter these out with `select(.masterTeamUuid == null)` to get only primary teams.

The SBVV association (Südbadischer Volleyball-Verband) UUID is `2b7571b5-f985-c552-ea1c-f819ed3811c1` and VC Müllheim's sportsclub UUID is `9c8b0252-c19b-4e83-a564-202e90d75c01`.

### Match structure

Individual match objects returned by `match-days/<uuid>/league-matches` have these key fields:

```json
{
  "date": "2026-03-07",
  "time": "14:00",
  "team1Description": "TV Merdingen 2",
  "team2Description": "VC Müllheim 1",
  "_embedded": {
    "team1": { "uuid": "..." },
    "team2": { "uuid": "f41dd752-07b0-42e8-afe2-4662a81eadf9" }
  }
}
```

The `leagueUuid` query parameter on the top-level `/league-matches` endpoint does **not** effectively filter results (ignores `seasonUuid` too, returns 200k+ historical matches). Always use the match-days approach instead: fetch `leagues/<uuid>/match-days`, then `match-days/<match-day-uuid>/league-matches` per day and filter by team UUID and date.

Match-day objects have a null `date` field — dates only exist on the individual match entries.

### Known UUIDs

| Resource | Name | UUID |
|---|---|---|
| Season | 2025/26 (current) | `fde078d8-b9d5-4202-be3d-5c2614cc8d95` |
| Association | Südbadischer Volleyball-Verband (SBVV) | `2b7571b5-f985-c552-ea1c-f819ed3811c1` |
| Sportsclub | VC Müllheim | `9c8b0252-c19b-4e83-a564-202e90d75c01` |
| League | Verbandsliga Herren | `2000b48f-eec8-4927-beb1-c4568069ebec` |
| League | Bezirksklasse Damen Süd | `a35b26d6-e212-4903-a529-2315642c7723` |
| League | Bezirksklasse Damen Mitte | `235406bb-0f96-4a1c-b631-e5abd8261808` |
| Team | VC Müllheim 1 (Herren / Verbandsliga) | `c2ddea7c-b7ec-4172-aa85-4d9c47aba362` |
| Team | VC Müllheim 1 (Damen / Bezirksklasse Süd) | `f41dd752-07b0-42e8-afe2-4662a81eadf9` |
| Team | VC Müllheim 2 (Damen / Bezirksklasse Mitte) | `88a52416-15f6-4dbc-b5d6-8d38a2bef737` |

## Usage

The URL path maps directly to positional arguments:

```
bun run .github/skills/sams-api/sams.ts <resource> [uuid] [subresource] [--query key=value ...]
```

Run without arguments (or with `--help`) to print the full endpoint reference. The full list of resources, sub-resources, and available query parameters is in the swagger at `https://www.volleyball-baden.de/api/v2/swagger.json`.

## Verify the API key

```bash
bun run .github/skills/sams-api/sams.ts seasons --query size=1
```

A `200` response with a `content` array confirms the key is valid.

## Common investigation workflow

1. **Find the current season UUID** → `seasons`, filter `.content[] | select(.currentSeason == true)`
2. **Get SBVV leagues for the season** → `leagues --query association=2b7571b5-f985-c552-ea1c-f819ed3811c1 --query size=100`, then filter `.content[] | select(.seasonUuid == "<season-uuid>")`
   - Note: The SBVV association UUID is `2b7571b5-f985-c552-ea1c-f819ed3811c1`. It can be confirmed with `associations 2b7571b5-f985-c552-ea1c-f819ed3811c1` (returns `"name": "Südbadischer Volleyball-Verband"`), but it does **not** appear in the paginated `/associations` list — this is a known upstream API bug.
3. **Find VC Müllheim's teams in a league** → `leagues <league-uuid> teams`, filter `.content[] | select(.sportsclubUuid == "9c8b0252-c19b-4e83-a564-202e90d75c01" and (.masterTeamUuid == null))`
   - VC Müllheim's sportsclub UUID `9c8b0252-c19b-4e83-a564-202e90d75c01` was found by paginating `associations 2b7571b5-f985-c552-ea1c-f819ed3811c1 sportsclubs --query size=100 --query page=<n>` and searching `.content[] | select(.name | test("llheim"; "i"))`.
4. **Inspect rankings** → `leagues <league-uuid> rankings`
5. **Find upcoming matches for a team** → fetch `leagues <league-uuid> match-days`, then iterate `match-days <match-day-uuid> league-matches` for the last N match-day UUIDs and filter with jq:
   ```bash
   bun run .github/skills/sams-api/sams.ts match-days <md-uuid> league-matches | \
     jq '[.content[] | select(.date >= "2026-02-22") | select(._embedded.team1.uuid == "<team-uuid>" or ._embedded.team2.uuid == "<team-uuid>") | {date, time, home: .team1Description, guest: .team2Description}]'
   ```

## Rate limits

- **Max 5 requests per second** — at least 200 ms must pass between requests. When making multiple sequential calls (e.g. in a workflow), wait 200 ms between each invocation.
- **Daily limit per API key** — if the daily quota is exceeded the key is blocked until midnight. Avoid bulk-fetching all endpoints in a single session; only request what is needed to answer the question.

## Error interpretation

- **HTTP 401** — API key is missing, wrong, or expired. Check `SAMS_API_KEY` in `.env.local`.
- **HTTP 404** — the UUID does not exist or does not belong to the expected resource type.
- **HTTP 429** — rate limit hit (>5 req/s). Wait at least 200 ms and retry. If the daily quota is exhausted, the key is blocked until the next day.
