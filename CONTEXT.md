# VC Müllheim Website

Public website and admin app for VC Müllheim, including SAMS league data (matches, rankings, teams).

## Language

**Synced season**:
The season UUID stored on team records by the teams sync, read from DynamoDB when loading matches.
_Avoid_: Current season, live season

**Effective match input**:
The resolved query parameters (clubs, season, team, range, limit) used for cache keys and React Query after server-side resolution.
_Avoid_: Hook options (implementation term), query params

**Cache peek**:
A DynamoDB-only read of cached SAMS data that never calls the external SAMS API during SSR navigation.
_Avoid_: SSR fetch, preload

**Configured club**:
A sportsclub listed in project config whose `sportsclubUuid` is resolved from the SAMS clubs sync in DynamoDB.
_Avoid_: Target club, default club
