import dayjs from "dayjs";
import { busSchema } from "@/lib/db/schemas";
import { putItems, type SeedContext } from "./common";

export async function seedBusData(ctx: SeedContext): Promise<void> {
  console.log("\n🚌 Seeding bus bookings...");

  const busBookings = [
    {
      id: crypto.randomUUID(),
      driver: "Hans Mueller",
      comment:
        "Auswärtsspiel Herren 1 in Freiburg - Abfahrt pünktlich um 17:00 Uhr. Bitte 10 Min vorher da sein.",
      from: dayjs().subtract(7, "days").hour(17).minute(0).second(0).toISOString(),
      to: dayjs().subtract(7, "days").hour(23).minute(0).second(0).toISOString(),
      ttl: Math.floor(dayjs().subtract(30, "days").valueOf() / 1000),
      createdAt: dayjs().subtract(14, "days").toISOString(),
      updatedAt: dayjs().subtract(12, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      driver: "Klaus Schmidt",
      comment:
        "Vereinsfahrt zum Turnier Basel - Overnight trip. Hotel info wird separat verschickt.",
      from: dayjs().add(21, "days").hour(8).minute(0).second(0).toISOString(),
      to: dayjs().add(22, "days").hour(20).minute(0).second(0).toISOString(),
      ttl: Math.floor(dayjs().add(22, "days").hour(20).valueOf() / 1000),
      createdAt: dayjs().subtract(30, "days").toISOString(),
      updatedAt: dayjs().subtract(5, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      driver: "Werner Wagner",
      comment: "Trainingswochenende Schwarzwald - Unterkunft im Vereinsheim. Verpflegung inkl.",
      from: dayjs().add(35, "days").hour(9).minute(30).second(0).toISOString(),
      to: dayjs().add(36, "days").hour(18).minute(0).second(0).toISOString(),
      ttl: Math.floor(dayjs().add(36, "days").hour(18).valueOf() / 1000),
      createdAt: dayjs().subtract(45, "days").toISOString(),
      updatedAt: dayjs().subtract(8, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      driver: "Thomas Klein",
      comment: "Regionales Pokalturnier Offenburg - Tagesfahrt. Mittagessen vor Ort möglich.",
      from: dayjs().add(14, "days").hour(10).minute(0).second(0).toISOString(),
      to: dayjs().add(14, "days").hour(19).minute(0).second(0).toISOString(),
      ttl: Math.floor(dayjs().add(14, "days").hour(19).valueOf() / 1000),
      createdAt: dayjs().subtract(20, "days").toISOString(),
      updatedAt: dayjs().toISOString(),
    },
  ];

  const validatedBusBookings = busBookings.map((booking) => busSchema.parse(booking));

  await putItems(ctx.entities.bus, validatedBusBookings);
  console.log(`✅ Seeded ${validatedBusBookings.length} bus bookings`);
}
