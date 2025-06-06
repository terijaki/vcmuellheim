import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sams_teams" RENAME COLUMN "matchseries_name" TO "league_name";
  ALTER TABLE "sams_teams" RENAME COLUMN "season" TO "season_name";
  DROP INDEX IF EXISTS "sams_clubs_sportsclub_id_idx";
  ALTER TABLE "sams_teams" ADD COLUMN "association_uuid" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN "sportsclub_uuid" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN "league_uuid" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN "season_uuid" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN "sportsclub_uuid" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN "association_uuid" varchar;
  
  -- Migrate data from old column to new column
  UPDATE "sams_clubs" SET "sportsclub_uuid" = "sportsclub_id" WHERE "sportsclub_id" IS NOT NULL;
  
  -- Now add NOT NULL constraint
  ALTER TABLE "sams_clubs" ALTER COLUMN "sportsclub_uuid" SET NOT NULL;
  
  CREATE UNIQUE INDEX IF NOT EXISTS "sams_clubs_sportsclub_uuid_idx" ON "sams_clubs" USING btree ("sportsclub_uuid");
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
   DROP INDEX IF EXISTS "sams_clubs_sportsclub_uuid_idx";
  ALTER TABLE "sams_teams" ADD COLUMN "season_team_id" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN "season" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN "matchseries_name" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN "matchseries_id" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN "matchseries_uuid" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN "matchseries_allseasonid" varchar;
  ALTER TABLE "sams_teams" ADD COLUMN "matchseries_type" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN "sportsclub_id" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN "lsb_number" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN "internal_sportsclub_id" varchar;
  ALTER TABLE "sams_clubs" ADD COLUMN "homepage" varchar;
  
  -- Migrate data back from new column to old column
  UPDATE "sams_clubs" SET "sportsclub_id" = "sportsclub_uuid" WHERE "sportsclub_uuid" IS NOT NULL;
  
  -- Now add NOT NULL constraint to old column
  ALTER TABLE "sams_clubs" ALTER COLUMN "sportsclub_id" SET NOT NULL;
  
  CREATE UNIQUE INDEX IF NOT EXISTS "sams_clubs_sportsclub_id_idx" ON "sams_clubs" USING btree ("sportsclub_id");
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "association_uuid";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "sportsclub_uuid";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "league_uuid";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "league_name";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "season_uuid";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "season_name";
  ALTER TABLE "sams_clubs" DROP COLUMN IF EXISTS "sportsclub_uuid";
  ALTER TABLE "sams_clubs" DROP COLUMN IF EXISTS "association_uuid";`)
}
