import dayjs from "dayjs";
import { locationSchema } from "@/lib/db/schemas";
import { putItems, type SeedContext } from "./common";

export async function seedLocationsData(ctx: SeedContext): Promise<void> {
  console.log("\n📍 Seeding locations...");

  const locations = [
    {
      name: "Römerhalle Müllheim",
      description: "Haupttrainingsstätte des VC Müllheim",
      street: "Zum Sportplatz 1",
      postal: "79379",
      city: "Müllheim",
    },
    {
      name: "Vereinsheim VC Müllheim",
      description: "Soziale Räume für Mitgliedertreffen und Events",
      street: "Markgrafenstrasse 45",
      postal: "79379",
      city: "Müllheim",
    },
    {
      name: "Beach-Anlage Römerhalle",
      description: "Outdoor Beach-Volleyball Plätze",
      street: "Zum Sportplatz 2",
      postal: "79379",
      city: "Müllheim",
    },
  ];

  const locationsWithBaseMeta = locations.map((loc) => ({
    ...loc,
    id: crypto.randomUUID(),
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
  }));

  const validatedLocations = locationsWithBaseMeta.map((loc) => locationSchema.parse(loc));

  await putItems(ctx.entities.location, validatedLocations);
  console.log(`✅ Seeded ${validatedLocations.length} locations`);
  ctx.locationCache.push(...validatedLocations);
}
