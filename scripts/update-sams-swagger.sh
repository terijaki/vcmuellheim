#!/bin/bash

# Script to download and patch the SAMS swagger file
# This adds a missing "Object" schema that the volleyball-baden.de API references but doesn't define

set -e

echo "Downloading swagger.json from volleyball-baden.de..."
curl -s https://www.volleyball-baden.de/api/v2/swagger.json | \
  jq '.components.schemas.Object = {"type": "object", "additionalProperties": true}' > \
  data/sams/swagger.json

echo "✅ swagger.json updated successfully"
