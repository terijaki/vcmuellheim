import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_teams_schedule_day" RENAME TO "enum_teams_schedules_day";
  CREATE TABLE IF NOT EXISTS "sams_teams" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"full_name" varchar,
  	"name" varchar NOT NULL,
  	"uuid" varchar NOT NULL,
  	"season_team_id" varchar,
  	"season" varchar,
  	"matchseries_name" varchar,
  	"matchseries_id" varchar,
  	"matchseries_uuid" varchar,
  	"matchseries_allseasonid" varchar,
  	"matchseries_type" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "teams_schedule_day" RENAME TO "teams_schedules_day";
  ALTER TABLE "teams_schedule" RENAME TO "teams_schedules";
  ALTER TABLE "teams_schedules_day" DROP CONSTRAINT "teams_schedule_day_parent_fk";
  
  ALTER TABLE "teams_schedules" DROP CONSTRAINT "teams_schedule_location_id_locations_id_fk";
  
  ALTER TABLE "teams_schedules" DROP CONSTRAINT "teams_schedule_parent_id_fk";
  
  DROP INDEX IF EXISTS "teams_schedule_day_order_idx";
  DROP INDEX IF EXISTS "teams_schedule_day_parent_idx";
  DROP INDEX IF EXISTS "teams_schedule_order_idx";
  DROP INDEX IF EXISTS "teams_schedule_parent_id_idx";
  DROP INDEX IF EXISTS "teams_schedule_location_idx";
  ALTER TABLE "teams" ADD COLUMN "sbvv_team_id" uuid;
  ALTER TABLE "teams_rels" ADD COLUMN "media_id" uuid;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sams_teams_id" uuid;
  CREATE UNIQUE INDEX IF NOT EXISTS "sams_teams_uuid_idx" ON "sams_teams" USING btree ("uuid");
  CREATE INDEX IF NOT EXISTS "sams_teams_updated_at_idx" ON "sams_teams" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "sams_teams_created_at_idx" ON "sams_teams" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "teams_schedules_day" ADD CONSTRAINT "teams_schedules_day_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."teams_schedules"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "teams_schedules" ADD CONSTRAINT "teams_schedules_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "teams_schedules" ADD CONSTRAINT "teams_schedules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "teams" ADD CONSTRAINT "teams_sbvv_team_id_sams_teams_id_fk" FOREIGN KEY ("sbvv_team_id") REFERENCES "public"."sams_teams"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "teams_rels" ADD CONSTRAINT "teams_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sams_teams_fk" FOREIGN KEY ("sams_teams_id") REFERENCES "public"."sams_teams"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "teams_schedules_day_order_idx" ON "teams_schedules_day" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "teams_schedules_day_parent_idx" ON "teams_schedules_day" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "teams_schedules_order_idx" ON "teams_schedules" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "teams_schedules_parent_id_idx" ON "teams_schedules" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "teams_schedules_location_idx" ON "teams_schedules" USING btree ("location_id");
  CREATE INDEX IF NOT EXISTS "teams_sbvv_team_idx" ON "teams" USING btree ("sbvv_team_id");
  CREATE INDEX IF NOT EXISTS "teams_rels_media_id_idx" ON "teams_rels" USING btree ("media_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sams_teams_id_idx" ON "payload_locked_documents_rels" USING btree ("sams_teams_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_teams_schedules_day" RENAME TO "enum_teams_schedule_day";
  ALTER TABLE "sams_teams" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "sams_teams" CASCADE;
  ALTER TABLE "teams_schedules_day" RENAME TO "teams_schedule_day";
  ALTER TABLE "teams_schedules" RENAME TO "teams_schedule";
  ALTER TABLE "teams_schedule_day" DROP CONSTRAINT "teams_schedules_day_parent_fk";
  
  ALTER TABLE "teams_schedule" DROP CONSTRAINT "teams_schedules_location_id_locations_id_fk";
  
  ALTER TABLE "teams_schedule" DROP CONSTRAINT "teams_schedules_parent_id_fk";
  
  ALTER TABLE "teams" DROP CONSTRAINT "teams_sbvv_team_id_sams_teams_id_fk";
  
  ALTER TABLE "teams_rels" DROP CONSTRAINT "teams_rels_media_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sams_teams_fk";
  
  DROP INDEX IF EXISTS "teams_schedules_day_order_idx";
  DROP INDEX IF EXISTS "teams_schedules_day_parent_idx";
  DROP INDEX IF EXISTS "teams_schedules_order_idx";
  DROP INDEX IF EXISTS "teams_schedules_parent_id_idx";
  DROP INDEX IF EXISTS "teams_schedules_location_idx";
  DROP INDEX IF EXISTS "teams_sbvv_team_idx";
  DROP INDEX IF EXISTS "teams_rels_media_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_sams_teams_id_idx";
  DO $$ BEGIN
   ALTER TABLE "teams_schedule_day" ADD CONSTRAINT "teams_schedule_day_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."teams_schedule"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "teams_schedule" ADD CONSTRAINT "teams_schedule_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "teams_schedule" ADD CONSTRAINT "teams_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "teams_schedule_day_order_idx" ON "teams_schedule_day" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "teams_schedule_day_parent_idx" ON "teams_schedule_day" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "teams_schedule_order_idx" ON "teams_schedule" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "teams_schedule_parent_id_idx" ON "teams_schedule" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "teams_schedule_location_idx" ON "teams_schedule" USING btree ("location_id");
  ALTER TABLE "teams" DROP COLUMN IF EXISTS "sbvv_team_id";
  ALTER TABLE "teams_rels" DROP COLUMN IF EXISTS "media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "sams_teams_id";`)
}
