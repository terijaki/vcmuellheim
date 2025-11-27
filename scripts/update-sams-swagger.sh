#!/bin/bash

# Script to download and patch the SAMS swagger file
# Fix invalid $ref to missing Object schema in _embedded and _links properties
# Replace with inline type definition to avoid generation errors

set -e

echo "Downloading swagger.json from volleyball-baden.de..."
curl -s https://www.volleyball-baden.de/api/v2/swagger.json | \
  jq 'walk(
    if type == "object" and has("additionalProperties") and 
       .additionalProperties == {"$ref": "#/components/schemas/Object"} 
    then .additionalProperties = {} 
    else . 
    end
  )' > \
  codegen/sams/swagger.json

echo "✅ swagger.json updated successfully"
