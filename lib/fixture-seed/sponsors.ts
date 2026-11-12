import dayjs from "dayjs";
import { sponsorSchema } from "@/lib/db/schemas";
import { putItems, type SeedContext, uploadSeedAssetToS3 } from "./common";
import { SPONSOR_LOGO_ASSETS } from "./seed-assets";

export async function seedSponsorsData(ctx: SeedContext): Promise<void> {
  console.log("\n💰 Seeding sponsors...");

  const sponsors = [
    {
      id: crypto.randomUUID(),
      name: "Müllheim Bank AG",
      description: "Hauptsponsor des VC Müllheim seit 2020",
      websiteUrl: "https://www.muellheimbank.de",
      logoS3Key: "",
      ttl: Math.floor(dayjs().add(1, "year").valueOf() / 1000),
      createdAt: dayjs().subtract(2, "years").toISOString(),
      updatedAt: dayjs().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "Sporthaus Schmidt",
      description: "Ausrüster für Sportbekleidung und Equipment",
      websiteUrl: "https://www.sporthaus-schmidt.de",
      logoS3Key: "",
      ttl: Math.floor(dayjs().add(6, "months").valueOf() / 1000),
      createdAt: dayjs().subtract(1, "year").toISOString(),
      updatedAt: dayjs().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "Bäckerei Hoffmann",
      description: "Versorger von Verpflegung bei Heimspielen",
      logoS3Key: "",
      ttl: Math.floor(dayjs().add(8, "months").valueOf() / 1000),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      name: "Fitness Plus Müllheim",
      description: "Partner für Krafttraining und Sportwissenschaft",
      websiteUrl: "https://www.fitnessplus-muellheim.de",
      logoS3Key: "",
      ttl: Math.floor(dayjs().add(10, "months").valueOf() / 1000),
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    },
  ];

  const validatedSponsors = sponsors.map((sponsor) => sponsorSchema.parse(sponsor));

  console.log("  Uploading sponsor logos...");
  for (let i = 0; i < validatedSponsors.length; i++) {
    try {
      const finalKey = `sponsors/${validatedSponsors[i].id}-logo.jpg`;
      const asset = SPONSOR_LOGO_ASSETS[i];
      if (!asset) {
        throw new Error("Missing sponsor logo fixture asset");
      }
      await uploadSeedAssetToS3(ctx, asset, finalKey);
      validatedSponsors[i].logoS3Key = finalKey;
    } catch (error) {
      console.warn(`  ⚠️  Failed to upload logo for ${validatedSponsors[i].name}:`, error);
    }
  }

  await putItems(ctx.entities.sponsor, validatedSponsors);
  console.log(`✅ Seeded ${validatedSponsors.length} sponsors`);
}
