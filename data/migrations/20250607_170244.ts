import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "news" DROP COLUMN IF EXISTS "is_published";
  ALTER TABLE "_news_v" DROP COLUMN IF EXISTS "version_is_published";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "news" ADD COLUMN "is_published" boolean DEFAULT true;
  ALTER TABLE "_news_v" ADD COLUMN "version_is_published" boolean DEFAULT true;`)
}
