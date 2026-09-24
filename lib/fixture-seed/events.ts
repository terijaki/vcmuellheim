import dayjs from "dayjs";
import { eventSchema } from "@/lib/db/schemas";
import { putItems, type SeedContext } from "./common";

export async function seedEventsData(ctx: SeedContext): Promise<void> {
  console.log("\n📅 Seeding events...");

  const events = [
    {
      id: crypto.randomUUID(),
      type: "event" as const,
      title: "Heimspiel Herren 1 vs. VfB Friedrichshafen",
      description:
        "Spannende Begegnung unserer ersten Herrenmannschaft gegen den VfB Friedrichshafen in der Landesliga.",
      startDate: dayjs().subtract(3, "days").hour(19).minute(0).second(0).toISOString(),
      endDate: dayjs().subtract(3, "days").hour(21).minute(0).second(0).toISOString(),
      location: "Römerhalle Müllheim",
      variant: "Heimspiel",
      createdAt: dayjs().subtract(10, "days").toISOString(),
      updatedAt: dayjs().subtract(10, "days").toISOString(),
      teamIds: [ctx.teamCache[0]?.id].filter(Boolean),
    },
    {
      id: crypto.randomUUID(),
      type: "event" as const,
      title: "Jugendtraining Special: Sprungkraft",
      description:
        "Spezielles Trainingsprogramm für unsere Jugendmannschaften mit Fokus auf Sprungkraft und Technik.",
      startDate: dayjs().add(5, "days").hour(17).minute(30).second(0).toISOString(),
      endDate: dayjs().add(5, "days").hour(19).minute(30).second(0).toISOString(),
      location: "Römerhalle Müllheim",
      variant: "Training",
      createdAt: dayjs().subtract(7, "days").toISOString(),
      updatedAt: dayjs().subtract(7, "days").toISOString(),
      teamIds: [ctx.teamCache[2]?.id].filter(Boolean),
    },
    {
      id: crypto.randomUUID(),
      type: "event" as const,
      title: "Beach-Volleyball Turnier",
      description:
        "Unser jährliches Beach-Volleyball Turnier! Anmeldung bis 31.05. Teams mit 2-4 Spielern willkommen.",
      startDate: dayjs().add(14, "days").hour(10).minute(0).second(0).toISOString(),
      endDate: dayjs().add(15, "days").hour(18).minute(0).second(0).toISOString(),
      location: "Beach-Anlage Römerhalle",
      variant: "Turnier",
      createdAt: dayjs().subtract(20, "days").toISOString(),
      updatedAt: dayjs().subtract(5, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "event" as const,
      title: "Mitgliederversammlung 2025",
      description:
        "Ordentliche Mitgliederversammlung mit Vorstandswahl und Bericht über das vergangene Vereinsjahr.",
      startDate: dayjs().add(21, "days").hour(19).minute(0).second(0).toISOString(),
      endDate: dayjs().add(21, "days").hour(21).minute(30).second(0).toISOString(),
      location: "Vereinsheim VC Müllheim",
      variant: "Mitgliedertreffen",
      createdAt: dayjs().subtract(30, "days").toISOString(),
      updatedAt: dayjs().subtract(30, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "event" as const,
      title: "Schnuppertraining für Anfänger",
      description:
        "Du wolltest schon immer Volleyball spielen? Komm vorbei zum kostenlosen Schnuppertraining! Keine Vorkenntnisse nötig.",
      startDate: dayjs().add(7, "days").hour(18).minute(0).second(0).toISOString(),
      endDate: dayjs().add(7, "days").hour(20).minute(0).second(0).toISOString(),
      location: "Römerhalle Müllheim",
      variant: "Training",
      createdAt: dayjs().subtract(14, "days").toISOString(),
      updatedAt: dayjs().subtract(14, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "event" as const,
      title: "Weihnachtsfeier 🎅",
      description:
        "Gemütliche Weihnachtsfeier für alle Mitglieder, Freunde und Familie. Mit Wichteln, Glühwein und gutem Essen!",
      startDate: dayjs().add(95, "days").hour(18).minute(30).second(0).toISOString(),
      endDate: dayjs().add(95, "days").hour(23).minute(0).second(0).toISOString(),
      location: "Vereinsheim VC Müllheim",
      variant: "Soziales",
      createdAt: dayjs().subtract(25, "days").toISOString(),
      updatedAt: dayjs().subtract(18, "days").toISOString(),
    },
  ];

  const validatedEvents = events.map((event) => eventSchema.parse(event));

  await putItems(ctx.entities.event, validatedEvents);
  console.log(`✅ Seeded ${validatedEvents.length} events`);
}
