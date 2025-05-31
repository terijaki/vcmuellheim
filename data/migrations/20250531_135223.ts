import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE IF NOT EXISTS "bus_bookings" (
  	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  	"booker" varchar NOT NULL,
  	"comment" varchar,
  	"schedule_start" timestamp(3) with time zone NOT NULL,
  	"schedule_end" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bus_bookings_id" uuid;
  CREATE INDEX IF NOT EXISTS "bus_bookings_updated_at_idx" ON "bus_bookings" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "bus_bookings_created_at_idx" ON "bus_bookings" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bus_bookings_fk" FOREIGN KEY ("bus_bookings_id") REFERENCES "public"."bus_bookings"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_bus_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bus_bookings_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bus_bookings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "bus_bookings" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_bus_bookings_fk";
  
  DROP INDEX IF EXISTS "payload_locked_documents_rels_bus_bookings_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "bus_bookings_id";`)
}
