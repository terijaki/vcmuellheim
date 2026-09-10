# VC Müllheim Website

Public website and admin app for VC Müllheim, including SAMS league data (matches, rankings, teams).

## Language

**Application Tabelle**:
The write-time standings read model for the currently published season, keyed for a single Query without season or club discovery.
_Avoid_: Ranking projection (canonical SAMS league/season blob)

**Application Termine**:
The write-time match calendar read model for configured clubs, date-sorted and range-partitioned for past/future queries.
_Avoid_: Schedule projection (canonical SAMS club/season match blob)

**Synced season**:
The season UUID stored on team records by the teams sync. Application Tabelle/Termine read models resolve and publish it at SAMS write/rebuild time so page loaders do not rediscover it.
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
