import dayjs from "dayjs";
import { volunteerEventSchema, volunteerSignupSchema } from "@/lib/db/schemas";
import { putItems, type SeedContext } from "./common";

export async function seedVolunteerEventsData(ctx: SeedContext): Promise<void> {
  console.log("\n🤝 Seeding volunteer events...");

  const volunteerEvents = [
    {
      id: crypto.randomUUID(),
      type: "volunteerEvent" as const,
      title: "Frühjahrsputz im Vereinsheim",
      description: "Gemeinsames Aufräumen und Aufbereiten des Vereinsheims für die neue Saison.",
      location: "Vereinsheim VC Müllheim",
      organizerName: "Miriam Weber",
      organizerEmail: "volunteer@vc-muellheim.de",
      shifts: [
        {
          id: crypto.randomUUID(),
          label: "Aufräumen und Staub wischen",
          startDate: dayjs().subtract(2, "days").hour(9).minute(0).second(0).toISOString(),
          endDate: dayjs().subtract(2, "days").hour(12).minute(0).second(0).toISOString(),
          roles: [
            {
              id: crypto.randomUUID(),
              label: "Helfer:in im Eingangsbereich",
              description: "Gäste begrüßen und die Räume vorbereiten.",
              minCapacity: 1,
              maxCapacity: 2,
            },
          ],
        },
      ],
      createdAt: dayjs().subtract(10, "days").toISOString(),
      updatedAt: dayjs().subtract(10, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "volunteerEvent" as const,
      title: "Kartenverkauf beim Sommerturnier",
      description: "Hilf beim Verkauf der Eintrittskarten und an der Information am Turniertag.",
      location: "Römerhalle Müllheim",
      organizerName: "Lars Zimmermann",
      organizerEmail: "turnierhilfe@vc-muellheim.de",
      shifts: [
        {
          id: crypto.randomUUID(),
          label: "Kartenverkauf am Eingang",
          startDate: dayjs().add(10, "days").hour(8).minute(30).second(0).toISOString(),
          endDate: dayjs().add(10, "days").hour(12).minute(0).second(0).toISOString(),
          roles: [
            {
              id: crypto.randomUUID(),
              label: "Kassenhilfe",
              description: "Eintrittskarten verkaufen und Besucher informieren.",
              minCapacity: 1,
              maxCapacity: 2,
            },
          ],
        },
      ],
      createdAt: dayjs().subtract(5, "days").toISOString(),
      updatedAt: dayjs().subtract(5, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "volunteerEvent" as const,
      title: "Tag der offenen Tür für neue Mitglieder",
      description:
        "Wir begrüßen Interessierte und benötigen Unterstützung bei der Organisation und Betreuung.",
      location: "Vereinsheim VC Müllheim",
      organizerName: "Anna Hoffmann",
      organizerEmail: "oeffnung@vc-muellheim.de",
      shifts: [
        {
          id: crypto.randomUUID(),
          label: "Check-in und Begrüßung",
          startDate: dayjs().add(3, "weeks").hour(14).minute(0).second(0).toISOString(),
          endDate: dayjs().add(3, "weeks").hour(16).minute(0).second(0).toISOString(),
          roles: [
            {
              id: crypto.randomUUID(),
              label: "Willkommens-Team",
              description: "Neue Gäste empfangen und durch den Abend führen.",
              minCapacity: 2,
              maxCapacity: 3,
            },
          ],
        },
        {
          id: crypto.randomUUID(),
          label: "Küche und Getränke",
          startDate: dayjs().add(3, "weeks").hour(15).minute(0).second(0).toISOString(),
          endDate: dayjs().add(3, "weeks").hour(18).minute(0).second(0).toISOString(),
          roles: [
            {
              id: crypto.randomUUID(),
              label: "Kiosk-Hilfe",
              description: "Getränke und kleine Snacks servieren.",
              minCapacity: 1,
              maxCapacity: 2,
            },
            {
              id: crypto.randomUUID(),
              label: "Küchenhilfe",
              description: "Unterstützung bei der Vorbereitung und dem Abbau.",
              minCapacity: 1,
              maxCapacity: 2,
            },
          ],
        },
      ],
      createdAt: dayjs().subtract(3, "days").toISOString(),
      updatedAt: dayjs().subtract(3, "days").toISOString(),
    },
  ];

  const validatedVolunteerEvents = volunteerEvents.map((event) =>
    volunteerEventSchema.parse(event),
  );

  await putItems(ctx.entities.volunteerEvent, validatedVolunteerEvents);

  const volunteerSignups = [
    {
      id: crypto.randomUUID(),
      type: "volunteerSignup" as const,
      status: "confirmed" as const,
      eventId: validatedVolunteerEvents[0].id,
      shiftId: validatedVolunteerEvents[0].shifts[0].id,
      preferredRoleIds: [validatedVolunteerEvents[0].shifts[0].roles[0].id],
      assignedRoleId: validatedVolunteerEvents[0].shifts[0].roles[0].id,
      firstName: "Leonie",
      lastName: "Keller",
      email: "leonie.keller@example.com",
      dateOfBirth: "1995-04-12",
      association: "VC Müllheim",
      mobilePhone: "+49 176 12345678",
      note: "Kann auch am Nachmittag aushelfen.",
      createdAt: dayjs().subtract(8, "days").toISOString(),
      updatedAt: dayjs().subtract(8, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "volunteerSignup" as const,
      status: "pending" as const,
      eventId: validatedVolunteerEvents[1].id,
      shiftId: validatedVolunteerEvents[1].shifts[0].id,
      preferredRoleIds: [validatedVolunteerEvents[1].shifts[0].roles[0].id],
      firstName: "Tim",
      lastName: "Schneider",
      email: "tim.schneider@example.com",
      dateOfBirth: "1991-10-03",
      association: "VC Müllheim",
      mobilePhone: "+49 151 23456789",
      note: "Ich freue mich auf den Turniertag.",
      createdAt: dayjs().subtract(2, "days").toISOString(),
      updatedAt: dayjs().subtract(2, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "volunteerSignup" as const,
      status: "confirmed" as const,
      eventId: validatedVolunteerEvents[2].id,
      shiftId: validatedVolunteerEvents[2].shifts[0].id,
      preferredRoleIds: [validatedVolunteerEvents[2].shifts[0].roles[0].id],
      assignedRoleId: validatedVolunteerEvents[2].shifts[0].roles[0].id,
      firstName: "Nora",
      lastName: "Braun",
      email: "nora.braun@example.com",
      dateOfBirth: "2002-08-18",
      association: "Müllheimer Volleyballfreunde",
      createdAt: dayjs().subtract(1, "day").toISOString(),
      updatedAt: dayjs().subtract(1, "day").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "volunteerSignup" as const,
      status: "confirmed" as const,
      eventId: validatedVolunteerEvents[2].id,
      shiftId: validatedVolunteerEvents[2].shifts[1].id,
      preferredRoleIds: [validatedVolunteerEvents[2].shifts[1].roles[0].id],
      assignedRoleId: validatedVolunteerEvents[2].shifts[1].roles[0].id,
      firstName: "Mina",
      lastName: "Fischer",
      email: "mina.fischer@example.com",
      dateOfBirth: "1998-12-02",
      association: "VC Müllheim",
      mobilePhone: "+49 163 98765432",
      note: "Könnte auch beim Abbau unterstützen.",
      createdAt: dayjs().subtract(1, "day").toISOString(),
      updatedAt: dayjs().subtract(1, "day").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "volunteerSignup" as const,
      status: "pending" as const,
      eventId: validatedVolunteerEvents[2].id,
      shiftId: validatedVolunteerEvents[2].shifts[1].id,
      preferredRoleIds: [validatedVolunteerEvents[2].shifts[1].roles[1].id],
      firstName: "Jonas",
      lastName: "Wolf",
      email: "jonas.wolf@example.com",
      dateOfBirth: "1993-07-09",
      association: "VC Müllheim",
      mobilePhone: "+49 152 55667788",
      note: "Möchte gern in der Küche helfen.",
      createdAt: dayjs().subtract(1, "day").toISOString(),
      updatedAt: dayjs().subtract(1, "day").toISOString(),
    },
  ];

  const validatedVolunteerSignups = volunteerSignups.map((signup) =>
    volunteerSignupSchema.parse(signup),
  );

  await putItems(ctx.entities.volunteerSignup, validatedVolunteerSignups);
  console.log(
    `✅ Seeded ${validatedVolunteerEvents.length} volunteer events and ${validatedVolunteerSignups.length} signups`,
  );
}
