# SAMS API — Known Bugs & Quirks

Tested against `https://www.volleyball-baden.de/api/v2` on **2026-02-22**.  
All findings are verified against the remote Swagger spec at `https://www.volleyball-baden.de/api/v2/swagger.json`.  
All issues are upstream API defects.

---

## Bug Index

| # | Endpoint | Severity | Summary |
|---|---|---|---|
| 1 | `GET /associations` | High | SBVV (`2b7571b5-…`) absent from paginated list despite existing as a direct resource |
| 2 | `GET /teams/{uuid}` | Medium | `logoImageForScreenOutputLink` always `null` despite being documented as a `url`-format field |
| 3 | `GET /leagues/{uuid}/rankings` | Low | `scoreIncludingLosses` always `null` |
| 4 | Any endpoint | Low | `Accept: application/json` returns HTTP 406 — only `application/hal+json` is served |
| 5 | `GET /teams/{uuid}` | Low | `shortName` and `clubCode` return `""` for unset values instead of `null` |
| 6 | `GET /match-days/{uuid}/league-matches`, `GET /league-matches` | Low | `date` field declared as `format: date-time` but API returns a date-only string (`YYYY-MM-DD`) |

---

## Detailed Findings

### Bug 1 — SBVV missing from `GET /associations` list

**Endpoint:** `GET /associations`  
**Spec:** No filter parameter is documented that would exclude any association. The `association` query param filters *by parent*, not *against* a result — `GET /associations` is documented as returning all accessible associations.  
**Actual:** 210 associations across 3 pages. SBVV (`Südbadischer Volleyball-Verband`, UUID `2b7571b5-f985-c552-ea1c-f819ed3811c1`) is absent from all pages. Its sub-associations (`SBVV Bezirk West`, `SBVV Bezirk Schwarzwald-Bodensee`) appear, but the parent does not.  
**Confirmed:** `GET /associations/2b7571b5-f985-c552-ea1c-f819ed3811c1` returns the resource successfully — it exists but is not enumerated.  
**Workaround:** Always access SBVV directly by UUID.

---

### Bug 2 — `logoImageForScreenOutputLink` always `null`

**Endpoint:** `GET /teams/{uuid}`  
**Spec (`TeamDto`):** `logoImageForScreenOutputLink` is defined as `type: string, format: url` — a non-nullable URL field.  
**Actual:** Returns `null` for every tested team, including teams that have a populated `logoImageLink`.

```json
{
  "logoImageLink": "https://dvv.sams-server.de/uploads/…/USV-pink.png",
  "logoImageForScreenOutputLink": null
}
```

`logoImageLink` URLs are valid and return HTTP 200. Use `logoImageLink` as the only reliable logo source.

---

### Bug 3 — `scoreIncludingLosses` always `null` in rankings

**Endpoint:** `GET /leagues/{uuid}/rankings`  
**Spec (`LeagueRankingsEntryDto`):** `scoreIncludingLosses` is defined as `type: string`.  
**Actual:** Always `null` across all tested leagues. All other stat fields (`wins`, `losses`, `setWins`, `setLosses`, `matchesPlayed`, `points`) are correctly populated.

---

### Bug 4 — `Accept: application/json` returns HTTP 406

**All endpoints.**  
**Spec:** Response content type is defined as `application/hal+json; charset=UTF-8` only — `application/json` is not listed as an accepted variant.  
**Actual:** Confirmed — `Accept: application/json` → HTTP 406, `Accept: */*` → HTTP 200.  
**This is spec-compliant behaviour** but diverges from common REST API practice. Always send `Accept: */*`.

---

### Bug 5 — `shortName` / `clubCode` return `""` for unset values

**Endpoints:** `GET /teams/{uuid}`, `GET /sportsclubs/{uuid}`  
**Spec (`TeamDto`):** Both fields are `type: string` with no default value defined.  
**Actual:** Unset optional fields return `""` (empty string) rather than `null`.

```json
{ "shortName": "", "clubCode": "" }
```

Callers must guard against both `null` and `""` to detect a missing value.

---

### Bug 6 — `date` field declared as `date-time` but returns a date-only string

**Endpoints:** `GET /match-days/{uuid}/league-matches`, `GET /league-matches`  
**Spec (`LeagueMatchDto`, `CompetitionMatchDto`):** The `date` property is defined as `type: string, format: date-time`.  
**Actual:** The API returns a plain date string — `YYYY-MM-DD` — with no time component.

```json
{ "date": "2025-10-04", "time": "14:00" }
```

Note that the `time` is a separate string field (`HH:mm`), confirming the intent is a date-only `date` field. The `date-time` format in the spec is wrong — it should be `date`.  
**Workaround:** Override `date.format` to `"date"` in `parser.patch.schemas` for both DTOs (see `codegen/sams/generate-client.ts`).
