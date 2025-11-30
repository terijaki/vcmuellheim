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
             date_start_date as "startDate", 
             date_end_date as "endDate",
             address_name as "addressName",
             address_street as "addressStreet",
             address_postal_code as "addressPostalCode",
             address_city as "addressCity",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM events
    ) t),
    'members', (SELECT json_agg(json_build_object(
      'id', m.id,
      'name', m.name,
      'email', m.email,
      'phone', m.phone,
      'avatarS3Key', m.avatar_id,
      'createdAt', m.created_at,
      'updatedAt', m.updated_at,
      'roles', (
        SELECT json_agg(r.name)
        FROM members_rels mr
        JOIN roles r ON mr.roles_id = r.id
        WHERE mr.parent_id = m.id AND mr.path = 'roles'
      )
    )) FROM members m),
    'teams', (SELECT json_agg(json_build_object(
      'id', t.id,
      'name', t.name,
      'slug', t.slug,
      'description', t.description,
      'gender', 
        CASE 
          WHEN t.gender = 'men' THEN 'male'
          WHEN t.gender = 'woman' THEN 'female'
          ELSE t.gender::text
        END,
      'league', t.league,
      'age', t.age,
      'instagram', t.instagram,
      'sbvvTeamId', t.sbvv_team_id,
      'imageIds', (
        SELECT json_agg(tr.media_id)
        FROM teams_rels tr
        WHERE tr.parent_id = t.id AND tr.path = 'images'
      ),
      'trainerIds', (
        SELECT json_agg(tr.members_id)
        FROM teams_rels tr
        WHERE tr.parent_id = t.id AND tr.path = 'people.coaches'
      ),
      'pointOfContactIds', (
        SELECT json_agg(tr.members_id)
        FROM teams_rels tr
        WHERE tr.parent_id = t.id AND tr.path = 'people.contactPeople'
      ),
      'trainingSchedules', (
        SELECT json_agg(json_build_object(
          'days', (
            SELECT json_agg(
              CASE tsd.value::text
                WHEN 'sonntags' THEN 0
                WHEN 'montags' THEN 1
                WHEN 'dienstags' THEN 2
                WHEN 'mittwochs' THEN 3
                WHEN 'donnerstags' THEN 4
                WHEN 'freitags' THEN 5
                WHEN 'samstags' THEN 6
                ELSE NULL
              END
              ORDER BY tsd.order
            )
            FROM teams_schedules_day tsd
            WHERE tsd.parent_id = ts.id
          ),
          'startTime', to_char(ts.time_start_time, 'HH24:MI'),
          'endTime', to_char(ts.time_end_time, 'HH24:MI'),
          'locationId', ts.location_id
        ))
        FROM teams_schedules ts
        WHERE ts._parent_id = t.id
      ),
      'createdAt', t.created_at,
      'updatedAt', t.updated_at
    )) FROM teams t),
    'sponsors', (SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, name, website, logo_id as "logoS3Key", expiry_date as "expiryDate",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM sponsors
    ) t),
    'media', (SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, filename, url, mime_type as "mimeType", alt, width, height, filesize,
             created_at as "createdAt", updated_at as "updatedAt"
      FROM media
    ) t),
    'locations', (SELECT json_agg(json_build_object(
      'id', l.id,
      'name', l.name,
      'description', l.description,
      'addressStreet', l.address_street,
      'addressPostalCode', l.address_postal_code,
      'addressCity', l.address_city,
      'createdAt', l.created_at,
      'updatedAt', l.updated_at
    )) FROM locations l),
    'busBookings', (SELECT json_agg(json_build_object(
      'id', b.id,
      'comment', b.comment,
      'traveler', b.traveler,
      'scheduleStart', b.schedule_start,
      'scheduleEnd', b.schedule_end,
      'bookerId', b.booker_id,
      'createdAt', b.created_at,
      'updatedAt', b.updated_at
    )) FROM bus_bookings b)
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
