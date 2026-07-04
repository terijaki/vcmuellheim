---
name: sams-api
description: Test and verify the external SAMS REST API at https://www.volleyball-baden.de/api/v2. Use this skill when asked to explore, debug, or verify SAMS API responses — such as listing seasons, fetching rankings, looking up clubs or teams, or checking that the API key is valid. Requires SAMS_API_KEY loaded via Varlock.
argument-hint: "resource [uuid] [subresource] [--query key=value]"
---

# SAMS API Skill

Run [sams.ts](./sams.ts) with `tsx` to make calls against the SAMS REST API. See [API-OVERVIEW.md](./API-OVERVIEW.md) for the full data model, resource relationships, pagination patterns, and known quirks.

## Setup

- `SAMS_API_KEY` loaded via Varlock (`vpr`) — sent as `X-Api-Key`
- Base URL: `https://www.volleyball-baden.de/api/v2`
- Use `Accept: */*` — the API returns `application/hal+json` (`application/json` causes HTTP 406)

## Usage

```
vpr sams-api <resource> [uuid] [subresource] [--query key=value ...]
```

## Command Safety Policy (must follow)

Use only simple read-only SAMS queries in this exact shape:

```bash
vpr sams-api <resource> [uuid] [subresource] [--query key=value ...] [2>/dev/null] [| jq '<filter>']
```

Rules:

- Do not use command chaining or shell control operators (`;`, `&&`, `||`, subshells, redirects other than optional `2>/dev/null`).
- Use only `--query key=value` to refine results; do not mutate local files or run unrelated commands.
- If `jq` is used, keep it as a single trailing pipe and put the filter in single quotes.
- Prefer incremental exploration: list -> filter with `--query` -> optional `jq` projection.

Run without arguments or with `--help` for examples. Full endpoint reference: `https://www.volleyball-baden.de/api/v2/swagger.json`.

Verify the API key is working:

```bash
vpr sams-api leagues --query size=1
```

## Investigation workflow

1. **Current season** → `vpr sams-api seasons | jq '.[] | select(.currentSeason == true)'` _(bare array — no `.content[]`)_
2. **SBVV leagues** → `vpr sams-api leagues --query association=2b7571b5-f985-c552-ea1c-f819ed3811c1 --query size=100`
   - SBVV UUID `2b7571b5-f985-c552-ea1c-f819ed3811c1` does **not** appear in the paginated `/associations` list (known upstream bug) but is accessible directly via `associations <uuid>`.
3. **Teams in a league** → `vpr sams-api leagues <uuid> teams | jq '.content[] | select(.masterTeamUuid == null)'`
4. **Rankings** → `vpr sams-api leagues <uuid> rankings`
5. **Upcoming matches** → `vpr sams-api leagues <uuid> match-days`, then per match-day: `vpr sams-api match-days <uuid> league-matches`

## Rate limits & errors

- Max 5 req/s (200 ms between calls); daily quota per key — only fetch what is needed.
- **401** key missing/invalid · **404** UUID not found · **429** rate limit exceeded
