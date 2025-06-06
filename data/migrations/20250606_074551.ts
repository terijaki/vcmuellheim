import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  -- Only drop index if it exists
  DROP INDEX IF EXISTS "sams_clubs_sportsclub_id_idx";
  
  -- Add new columns to sams_teams (only if they don't exist)
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "association_uuid" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "sportsclub_uuid" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "league_uuid" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "season_uuid" varchar;
  
  -- Add new columns to sams_clubs (only if they don't exist)
  ALTER TABLE "sams_clubs" ADD COLUMN IF NOT EXISTS "sportsclub_uuid" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN IF NOT EXISTS "association_uuid" varchar;
  
  -- Migrate data from old column to new column (only if old column exists)
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sams_clubs' AND column_name='sportsclub_id') THEN
      UPDATE "sams_clubs" SET "sportsclub_uuid" = "sportsclub_id" WHERE "sportsclub_id" IS NOT NULL;
    END IF;
  END $$;
  
  -- Add NOT NULL constraint to sportsclub_uuid
  ALTER TABLE "sams_clubs" ALTER COLUMN "sportsclub_uuid" SET NOT NULL;
  
  -- Create unique index
  CREATE UNIQUE INDEX IF NOT EXISTS "sams_clubs_sportsclub_uuid_idx" ON "sams_clubs" USING btree ("sportsclub_uuid");
  
  -- Drop old columns only if they exist
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "season_team_id";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "matchseries_id";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "matchseries_uuid";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "matchseries_allseasonid";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "matchseries_type";
  ALTER TABLE "sams_clubs" DROP COLUMN IF EXISTS "sportsclub_id";
  ALTER TABLE "sams_clubs" DROP COLUMN IF EXISTS "lsb_number";
  ALTER TABLE "sams_clubs" DROP COLUMN IF EXISTS "internal_sportsclub_id";
  ALTER TABLE "sams_clubs" DROP COLUMN IF EXISTS "homepage";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  -- Drop the new index
  DROP INDEX IF EXISTS "sams_clubs_sportsclub_uuid_idx";
  
  -- Add back old columns
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "season_team_id" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "season" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "matchseries_name" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "matchseries_id" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "matchseries_uuid" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "matchseries_allseasonid" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN IF NOT EXISTS "matchseries_type" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN IF NOT EXISTS "sportsclub_id" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN IF NOT EXISTS "lsb_number" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN IF NOT EXISTS "internal_sportsclub_id" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN IF NOT EXISTS "homepage" varchar;
  
  -- Migrate data back from new column to old column
  UPDATE "sams_clubs" SET "sportsclub_id" = "sportsclub_uuid" WHERE "sportsclub_uuid" IS NOT NULL;
  
  -- Add NOT NULL constraint to old column
  ALTER TABLE "sams_clubs" ALTER COLUMN "sportsclub_id" SET NOT NULL;
  
  -- Recreate old index
  CREATE UNIQUE INDEX IF NOT EXISTS "sams_clubs_sportsclub_id_idx" ON "sams_clubs" USING btree ("sportsclub_id");
  
  -- Drop new columns
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "association_uuid";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "sportsclub_uuid";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "league_uuid";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "season_uuid";
  ALTER TABLE "sams_clubs" DROP COLUMN IF EXISTS "sportsclub_uuid";
  ALTER TABLE "sams_clubs" DROP COLUMN IF EXISTS "association_uuid";`)
}
