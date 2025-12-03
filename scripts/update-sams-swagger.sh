#!/bin/bash

# Script to download and patch the SAMS swagger file
# Fixes:
# 1. Invalid $ref to missing Object schema in _embedded and _links properties
# 2. Makes results and referees fields nullable using anyOf pattern (they can be null in the API)

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
  # Make results field nullable in LeagueMatchDto
  .components.schemas.LeagueMatchDto.properties.results = {
    "allOf": [{"$ref": "#/components/schemas/VolleyballMatchResultsDto"}],
    "nullable": true
  } |
  .components.schemas.CompetitionMatchDto.properties.results = {
    "allOf": [{"$ref": "#/components/schemas/VolleyballMatchResultsDto"}],
    "nullable": true
  } |
  # Make referees field nullable
  .components.schemas.LeagueMatchDto.properties.referees = {
    "allOf": [{"$ref": "#/components/schemas/RefereeTeamDto"}],
    "nullable": true
  } |
  .components.schemas.CompetitionMatchDto.properties.referees = {
    "allOf": [{"$ref": "#/components/schemas/RefereeTeamDto"}],
    "nullable": true
  }' > \
  codegen/sams/swagger.json

echo "✅ swagger.json updated successfully"
