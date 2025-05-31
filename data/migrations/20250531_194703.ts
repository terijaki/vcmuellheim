import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bus_bookings" ADD COLUMN "traveler" varchar;
  ALTER TABLE "bus_bookings" ADD COLUMN "booker_id" uuid NOT NULL;
  DO $$ BEGIN
   ALTER TABLE "bus_bookings" ADD CONSTRAINT "bus_bookings_booker_id_users_id_fk" FOREIGN KEY ("booker_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "bus_bookings_booker_idx" ON "bus_bookings" USING btree ("booker_id");
  ALTER TABLE "bus_bookings" DROP COLUMN IF EXISTS "booker";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "bus_bookings" DROP CONSTRAINT "bus_bookings_booker_id_users_id_fk";
  
  DROP INDEX IF EXISTS "bus_bookings_booker_idx";
  ALTER TABLE "bus_bookings" ADD COLUMN "booker" varchar NOT NULL;
  ALTER TABLE "bus_bookings" DROP COLUMN IF EXISTS "traveler";
  ALTER TABLE "bus_bookings" DROP COLUMN IF EXISTS "booker_id";`)
}
