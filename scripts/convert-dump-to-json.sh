#!/bin/bash
# Convert Postgres dump to JSON for migration
# Usage: bash scripts/convert-dump-to-json.sh .temp/pg-dump-postgres-1763852403.dmp

set -e

DUMP_FILE=$1

if [ -z "$DUMP_FILE" ]; then
  echo "❌ Usage: bash scripts/convert-dump-to-json.sh <dump-file.dmp>"
  exit 1
fi

if [ ! -f "$DUMP_FILE" ]; then
  echo "❌ Dump file not found: $DUMP_FILE"
  exit 1
fi

# Get script directory and output file
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_FILE="$PROJECT_ROOT/.temp/postgres-backup.json"

# Create .temp directory if it doesn't exist
mkdir -p "$PROJECT_ROOT/.temp"

echo "🔄 Converting Postgres dump to JSON..."
echo "   Dump: $DUMP_FILE"
echo "   Output: $OUTPUT_FILE"
echo ""

# Create temporary database name
TEMP_DB="migration_temp_$(date +%s)"

echo "1️⃣ Creating temporary database: $TEMP_DB"
createdb "$TEMP_DB" 2>/dev/null || {
  echo "⚠️  Database might already exist, trying to drop and recreate..."
  dropdb "$TEMP_DB" 2>/dev/null || true
  createdb "$TEMP_DB"
}

echo "2️⃣ Restoring dump to temporary database..."
pg_restore -d "$TEMP_DB" "$DUMP_FILE" 2>&1 | grep -v "^WARNING:" | grep -v "^pg_restore:" || {
  echo "   (ignoring common restore warnings)"
}

echo "3️⃣ Exporting to JSON..."

# Export data using psql and jq
psql "$TEMP_DB" -t -A -c "
  SELECT json_build_object(
    'news', (SELECT json_agg(json_build_object(
      'id', n.id,
      'title', n.title,
      'content', n.content,
      'excerpt', n.excerpt,
      'publishedDate', n.published_date,
      'imageIds', (
        SELECT json_agg(nr.media_id)
        FROM news_rels nr
        WHERE nr.parent_id = n.id AND nr.path = 'images'
      ),
      'createdAt', n.created_at,
      'updatedAt', n.updated_at
    )) FROM news n WHERE n._status = 'published'),
    'events', (SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, title, description, 
             date_start_date as \"startDate\", 
             date_end_date as \"endDate\",
             address_name as \"addressName\",
             address_street as \"addressStreet\",
             address_postal_code as \"addressPostalCode\",
             address_city as \"addressCity\",
             created_at as \"createdAt\", updated_at as \"updatedAt\"
      FROM events
    ) t),
    'members', (SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, name, email, phone, avatar_id as \"avatarS3Key\",
             created_at as \"createdAt\", updated_at as \"updatedAt\"
      FROM members
    ) t),
    'teams', (SELECT json_agg(row_to_json(t)) FROM (
      SELECT 
        t.id, t.name, t.slug, t.description, t.gender, t.league, t.age, t.instagram,
        t.sbvv_team_id as \"sbvvTeamId\",
        (
          SELECT json_agg(tr.media_id)
          FROM teams_rels tr
          WHERE tr.parent_id = t.id AND tr.path = 'images'
        ) as \"imageIds\",
        t.created_at as \"createdAt\", t.updated_at as \"updatedAt\"
      FROM teams t
    ) t),
    'sponsors', (SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, name, website, logo_id as \"logoS3Key\", expiry_date as \"expiryDate\",
             created_at as \"createdAt\", updated_at as \"updatedAt\"
      FROM sponsors
    ) t),
    'media', (SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, filename, url, mime_type as \"mimeType\", alt, width, height, filesize,
             created_at as \"createdAt\", updated_at as \"updatedAt\"
      FROM media
    ) t),
    'locations', (SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, name, description, 
             address_street as \"addressStreet\",
             address_postal_code as \"addressPostalCode\", 
             address_city as \"addressCity\",
             created_at as \"createdAt\", updated_at as \"updatedAt\"
      FROM locations
    ) t),
    'busBookings', (SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, comment, traveler,
             schedule_start as \"scheduleStart\",
             schedule_end as \"scheduleEnd\",
             booker_id as \"bookerId\",
             created_at as \"createdAt\", updated_at as \"updatedAt\"
      FROM bus_bookings
    ) t)
  );
" | jq '.' > "$OUTPUT_FILE" 2>&1

if [ ! -s "$OUTPUT_FILE" ]; then
  echo "❌ Error: Output file is empty"
  dropdb "$TEMP_DB"
  exit 1
fi

echo "4️⃣ Cleaning up temporary database..."
dropdb "$TEMP_DB"

echo ""
echo "✅ Conversion complete!"
echo "📦 Output saved to: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "  1. Dry run: bun run migrate:to-dynamo --backup=.temp/postgres-backup.json --all --dry-run"
echo "  2. Migrate: bun run migrate:to-dynamo --backup=.temp/postgres-backup.json --all"
