import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_news_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__news_v_version_status" AS ENUM('draft', 'published');
  CREATE TABLE IF NOT EXISTS "_news_v" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"parent_id" uuid,
  	"version_title" varchar,
  	"version_content" jsonb,
  	"version_is_published" boolean DEFAULT true,
  	"version_published_date" timestamp(3) with time zone,
  	"version_excerpt" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__news_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE IF NOT EXISTS "_news_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid,
  	"media_id" uuid
  );
  
  CREATE TABLE IF NOT EXISTS "sams_clubs" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"name" varchar NOT NULL,
  	"sportsclub_id" varchar NOT NULL,
  	"lsb_number" varchar,
  	"internal_sportsclub_id" varchar,
  	"logo" varchar,
  	"homepage" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "news" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "news" ALTER COLUMN "content" DROP NOT NULL;
  ALTER TABLE "news" ALTER COLUMN "published_date" DROP NOT NULL;
  ALTER TABLE "news" ADD COLUMN "_status" "enum_news_status" DEFAULT 'draft';
  ALTER TABLE "sams_teams" ADD COLUMN "name_with_series" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sams_clubs_id" uuid;
  DO $$ BEGIN
   ALTER TABLE "_news_v" ADD CONSTRAINT "_news_v_parent_id_news_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."news"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_news_v_rels" ADD CONSTRAINT "_news_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_news_v"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_news_v_rels" ADD CONSTRAINT "_news_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "_news_v_rels" ADD CONSTRAINT "_news_v_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "_news_v_parent_idx" ON "_news_v" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_news_v_version_version_updated_at_idx" ON "_news_v" USING btree ("version_updated_at");
  CREATE INDEX IF NOT EXISTS "_news_v_version_version_created_at_idx" ON "_news_v" USING btree ("version_created_at");
  CREATE INDEX IF NOT EXISTS "_news_v_version_version__status_idx" ON "_news_v" USING btree ("version__status");
  CREATE INDEX IF NOT EXISTS "_news_v_created_at_idx" ON "_news_v" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "_news_v_updated_at_idx" ON "_news_v" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "_news_v_latest_idx" ON "_news_v" USING btree ("latest");
  CREATE INDEX IF NOT EXISTS "_news_v_autosave_idx" ON "_news_v" USING btree ("autosave");
  CREATE INDEX IF NOT EXISTS "_news_v_rels_order_idx" ON "_news_v_rels" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "_news_v_rels_parent_idx" ON "_news_v_rels" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "_news_v_rels_path_idx" ON "_news_v_rels" USING btree ("path");
  CREATE INDEX IF NOT EXISTS "_news_v_rels_users_id_idx" ON "_news_v_rels" USING btree ("users_id");
  CREATE INDEX IF NOT EXISTS "_news_v_rels_media_id_idx" ON "_news_v_rels" USING btree ("media_id");
  CREATE UNIQUE INDEX IF NOT EXISTS "sams_clubs_sportsclub_id_idx" ON "sams_clubs" USING btree ("sportsclub_id");
  CREATE INDEX IF NOT EXISTS "sams_clubs_updated_at_idx" ON "sams_clubs" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "sams_clubs_created_at_idx" ON "sams_clubs" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sams_clubs_fk" FOREIGN KEY ("sams_clubs_id") REFERENCES "public"."sams_clubs"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "news__status_idx" ON "news" USING btree ("_status");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sams_clubs_id_idx" ON "payload_locked_documents_rels" USING btree ("sams_clubs_id");
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "full_name";
  ALTER TABLE "public"."teams" ALTER COLUMN "league" SET DATA TYPE text;
  DROP TYPE "public"."enum_teams_league";
  CREATE TYPE "public"."enum_teams_league" AS ENUM('1. Bundesliga', '2. Bundesliga', 'Dritte Liga', 'Regionalliga', 'Oberliga', 'Verbandsliga', 'Landesliga', 'Bezirksliga', 'Bezirksklasse', 'Kreisliga', 'Kreisklasse');
  ALTER TABLE "public"."teams" ALTER COLUMN "league" SET DATA TYPE "public"."enum_teams_league" USING "league"::"public"."enum_teams_league";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_news_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_news_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sams_clubs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "_news_v" CASCADE;
  DROP TABLE "_news_v_rels" CASCADE;
  DROP TABLE "sams_clubs" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sams_clubs_fk";
  
  DROP INDEX IF EXISTS "news__status_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_sams_clubs_id_idx";
  ALTER TABLE "news" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "news" ALTER COLUMN "content" SET NOT NULL;
  ALTER TABLE "news" ALTER COLUMN "published_date" SET NOT NULL;
  ALTER TABLE "sams_teams" ADD COLUMN "full_name" varchar;
  ALTER TABLE "news" DROP COLUMN IF EXISTS "_status";
  ALTER TABLE "sams_teams" DROP COLUMN IF EXISTS "name_with_series";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "sams_clubs_id";
  ALTER TABLE "public"."teams" ALTER COLUMN "league" SET DATA TYPE text;
  DROP TYPE "public"."enum_teams_league";
  CREATE TYPE "public"."enum_teams_league" AS ENUM('1. Bundesliga', '2. Bundesliga', 'Dritte Liga', 'Regionalliga', 'Oberliga', 'Verbandsliga', 'Landesliga', 'Bezirksklasse', 'Bezirksliga', 'Kreisliga', 'Kreisklasse');
  ALTER TABLE "public"."teams" ALTER COLUMN "league" SET DATA TYPE "public"."enum_teams_league" USING "league"::"public"."enum_teams_league";
  DROP TYPE "public"."enum_news_status";
  DROP TYPE "public"."enum__news_v_version_status";`)
}
