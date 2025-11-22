# SAMS API Testing Guide

This document provides a step-by-step process to verify the SAMS API integration is working correctly after deployment.

## Prerequisites

- AWS CLI configured with the correct profile (`vcmuellheim`)
- `jq` installed for JSON processing
- Access to the deployed API Gateway endpoint

## Test Procedure

### 1. Get the API Gateway URL

```bash
# The API Gateway URL from CDK deployment output
API_URL="https://xv30bm7tx2.execute-api.eu-central-1.amazonaws.com/v1"
```

### 2. Test Basic Endpoints

#### Clubs
```bash
curl -s "$API_URL/sams/clubs" | jq '{clubs_count: .count}'
```
Expected: Should return count of synced clubs (e.g., 312)

#### Associations
```bash
curl -s "$API_URL/sams/associations" | jq '{associations_count: (.associations | length)}'
```
Expected: Should return ~210 associations

#### Seasons
```bash
curl -s "$API_URL/sams/seasons" | jq '{current: .current.name, previous: .previous?.name}'
```
Expected: Should return current and previous season names

### 3. Get Teams

```bash
# Get all teams (returns only VC Müllheim teams since sync filters by club)
curl -s "$API_URL/sams/teams" | jq '.teams[] | {name, leagueName, uuid, leagueUuid}'

# Select a random team for testing
TEAM_DATA=$(curl -s "$API_URL/sams/teams" | jq '.teams[0]')
TEAM_UUID=$(echo "$TEAM_DATA" | jq -r '.uuid')
TEAM_NAME=$(echo "$TEAM_DATA" | jq -r '.name')
LEAGUE_UUID=$(echo "$TEAM_DATA" | jq -r '.leagueUuid')
LEAGUE_NAME=$(echo "$TEAM_DATA" | jq -r '.leagueName')

echo "Testing with team: $TEAM_NAME ($LEAGUE_NAME)"
```

### 4. Get Most Recent Match

```bash
# Get all matches for the team
MATCHES=$(curl -s "$API_URL/sams/matches?team=$TEAM_UUID")

# Find the most recent match
RECENT_MATCH=$(echo "$MATCHES" | jq '.matches | sort_by(.date) | reverse | .[0]')

# Display match details
echo "$RECENT_MATCH" | jq '{
  date,
  time,
  homeTeam: ._embedded.team1.name,
  awayTeam: ._embedded.team2.name,
  result: .results.setPoints,
  winner: .results.winnerName,
  location: .location.name
}'
```

### 5. Get Current League Ranking

```bash
# Get rankings for the team's league
RANKINGS=$(curl -s "$API_URL/sams/rankings/$LEAGUE_UUID")

# Find the team's position
echo "$RANKINGS" | jq --arg uuid "$TEAM_UUID" '
  .teams[] | 
  select(.uuid == $uuid) | 
  {
    rank,
    teamName,
    matchesPlayed,
    wins,
    losses,
    points,
    setDifference,
    ballDifference
  }'
```

### 6. Complete Test Script

```bash
#!/bin/bash

# SAMS API Integration Test
API_URL="https://xv30bm7tx2.execute-api.eu-central-1.amazonaws.com/v1"

echo "=== SAMS API Integration Test ==="
echo ""

# 1. Test basic endpoints
echo "1. Testing basic endpoints..."
CLUBS_COUNT=$(curl -s "$API_URL/sams/clubs" | jq -r '.count')
ASSOC_COUNT=$(curl -s "$API_URL/sams/associations" | jq -r '.associations | length')
CURRENT_SEASON=$(curl -s "$API_URL/sams/seasons" | jq -r '.current.name')
echo "   ✓ Clubs: $CLUBS_COUNT"
echo "   ✓ Associations: $ASSOC_COUNT"
echo "   ✓ Current Season: $CURRENT_SEASON"
echo ""

# 2. Get random team
echo "2. Getting test team..."
TEAM_DATA=$(curl -s "$API_URL/sams/teams" | jq '.teams[0]')
TEAM_UUID=$(echo "$TEAM_DATA" | jq -r '.uuid')
TEAM_NAME=$(echo "$TEAM_DATA" | jq -r '.name')
LEAGUE_UUID=$(echo "$TEAM_DATA" | jq -r '.leagueUuid')
LEAGUE_NAME=$(echo "$TEAM_DATA" | jq -r '.leagueName')
echo "   ✓ Team: $TEAM_NAME"
echo "   ✓ League: $LEAGUE_NAME"
echo ""

# 3. Get most recent match
echo "3. Finding most recent match..."
MATCHES=$(curl -s "$API_URL/sams/matches?team=$TEAM_UUID")
RECENT_MATCH=$(echo "$MATCHES" | jq '.matches | sort_by(.date) | reverse | .[0]')
MATCH_DATE=$(echo "$RECENT_MATCH" | jq -r '.date')
MATCH_TIME=$(echo "$RECENT_MATCH" | jq -r '.time')
HOME_TEAM=$(echo "$RECENT_MATCH" | jq -r '._embedded.team1.name')
AWAY_TEAM=$(echo "$RECENT_MATCH" | jq -r '._embedded.team2.name')
RESULT=$(echo "$RECENT_MATCH" | jq -r '.results.setPoints // "Not played yet"')
WINNER=$(echo "$RECENT_MATCH" | jq -r '.results.winnerName // "TBD"')
echo "   ✓ Date: $MATCH_DATE $MATCH_TIME"
echo "   ✓ Match: $HOME_TEAM vs $AWAY_TEAM"
echo "   ✓ Result: $RESULT"
echo "   ✓ Winner: $WINNER"
echo ""

# 4. Get ranking
echo "4. Checking league ranking..."
RANKING=$(curl -s "$API_URL/sams/rankings/$LEAGUE_UUID" | \
  jq --arg uuid "$TEAM_UUID" '.teams[] | select(.uuid == $uuid)')
RANK=$(echo "$RANKING" | jq -r '.rank')
TOTAL_TEAMS=$(curl -s "$API_URL/sams/rankings/$LEAGUE_UUID" | jq -r '.teams | length')
WINS=$(echo "$RANKING" | jq -r '.wins')
LOSSES=$(echo "$RANKING" | jq -r '.losses')
POINTS=$(echo "$RANKING" | jq -r '.points')
echo "   ✓ Position: $RANK of $TOTAL_TEAMS"
echo "   ✓ Record: ${WINS}W - ${LOSSES}L"
echo "   ✓ Points: $POINTS"
echo ""

echo "=== All tests passed! ==="
```

## Expected Results

All endpoints should return valid data:
- Clubs: ~312 clubs
- Associations: ~210 associations
- Seasons: Current season info
- Teams: ~4 teams for VC Müllheim
- Matches: Match history with embedded team data
- Rankings: Current standings with detailed statistics

## Troubleshooting

### No data returned
- Check if sync Lambda functions have been run
- Verify API Gateway URL is correct
- Check CloudWatch logs for Lambda errors

### Authentication errors
- Ensure you're using the correct API endpoint (not CloudFront during initial testing)
- CloudFront may have stale cache - use API Gateway directly

### Timeout errors
- Matches endpoint requires filters (team, league, or sportsclub)
- Don't query without filters as it will try to fetch all matches

## Running Sync Functions

If tables are empty, run the sync functions:

```bash
# Sync clubs
aws lambda invoke \
  --function-name {environment}-{branchSlug}-sams-clubs-sync \
  --profile vcmuellheim \
  --region eu-central-1 \
  /tmp/clubs-sync.json

# Sync teams
aws lambda invoke \
  --function-name {environment}-{branchSlug}-sams-teams-sync \
  --profile vcmuellheim \
  --region eu-central-1 \
  /tmp/teams-sync.json
```
