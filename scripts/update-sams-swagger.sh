#!/bin/bash

# Script to download and patch the SAMS swagger file
# Fixes:
# 1. Invalid $ref to missing Object schema in _embedded and _links properties
# 2. Makes results and referees fields nullable (they can be null in the API)

set -e

echo "Downloading swagger.json from volleyball-baden.de..."
curl -s https://www.volleyball-baden.de/api/v2/swagger.json | \
  jq 'walk(
    if type == "object" and has("additionalProperties") and 
       .additionalProperties == {"$ref": "#/components/schemas/Object"} 
    then .additionalProperties = {} 
    else . 
    end
  ) | 
  # Make results field nullable in LeagueMatchDto and CompetitionMatchDto
  .components.schemas.LeagueMatchDto.properties.results = {
    "$ref": "#/components/schemas/VolleyballMatchResultsDto",
    "nullable": true
  } |
  .components.schemas.CompetitionMatchDto.properties.results = {
    "$ref": "#/components/schemas/VolleyballMatchResultsDto",
    "nullable": true
  } |
  # Make referees field nullable
  .components.schemas.LeagueMatchDto.properties.referees = {
    "$ref": "#/components/schemas/RefereeTeamDto",
    "nullable": true
  } |
  .components.schemas.CompetitionMatchDto.properties.referees = {
    "$ref": "#/components/schemas/RefereeTeamDto",
    "nullable": true
  }' > \
  codegen/sams/swagger.json

echo "✅ swagger.json updated successfully"
