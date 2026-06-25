import dayjs from "dayjs";
import { newsSchema } from "@/lib/db/schemas";
import { putItems, type SeedContext, uploadImageToS3 } from "./common";

export async function seedNewsData(ctx: SeedContext): Promise<void> {
  console.log("\n📰 Seeding news articles...");

  const articles = [
    {
      id: crypto.randomUUID(),
      type: "article" as const,
      title: "VC Müllheim wird Meister der Landesliga!",
      slug: "vcm-meister-landesliga-2025",
      content:
        "<p>Ein sensationeller Erfolg! Unsere Herren 1 haben in diesem Jahr die Landesliga gewonnen und steigen damit in die Oberliga auf. Herzlichen Glückwunsch an das gesamte Team und besonders an Trainer Max Müller.</p>",
      excerpt:
        "Großer Erfolg für VC Müllheim: Die Herren 1 gewinnen die Landesliga und steigen auf!",
      status: "published" as const,
      imageS3Keys: [],
      tags: ["herren", "meister", "erfolg"],
      createdAt: dayjs().subtract(5, "days").toISOString(),
      updatedAt: dayjs().subtract(5, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "article" as const,
      title: "Neue Trainerin Julia Fischer im Team",
      slug: "neue-trainerin-julia-fischer",
      content:
        "<p>Wir freuen uns, Julia Fischer als neue Trainerin der Jugendmannschaft begrüßen zu dürfen. Mit ihrer langjährigen Erfahrung wird sie unsere jungen Talente optimal fördern.</p>",
      excerpt: "Julia Fischer verstärkt unser Trainerteam",
      status: "published" as const,
      imageS3Keys: [],
      tags: ["trainer", "jugend", "mannschaft"],
      createdAt: dayjs().subtract(15, "days").toISOString(),
      updatedAt: dayjs().subtract(15, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "article" as const,
      title: "Jahresrückblick 2024 - Danke für ein fantastisches Jahr!",
      slug: "jahresrueckblick-2024",
      content:
        "<p>Ein ereignisreiches Jahr liegt hinter uns. Wir schauen zurück auf viele spannende Spiele, erfolgreiche Trainingsperioden und wunderbare Momente als Gemeinschaft.</p><p>Danke an alle Spieler, Trainer und Unterstützer!</p>",
      excerpt: "Rückblick auf ein erfolgreiches Jahr 2024",
      status: "published" as const,
      imageS3Keys: [],
      tags: ["rückblick", "danksagung", "gemeinschaft"],
      createdAt: dayjs().subtract(30, "days").toISOString(),
      updatedAt: dayjs().subtract(30, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "article" as const,
      title: "Saisonvorbereitung 2025/26 startet bald",
      slug: "saisonvorbereitung-2025-26",
      content:
        "<p>Die Vorbereitungen für die neue Saison laufen auf Hochtouren. Alle Teams freuen sich auf ein intensives Training und spannende Matches!</p>",
      excerpt: "Saisonvorbereitung 2025/26 beginnt in Kürze",
      status: "draft" as const,
      imageS3Keys: [],
      tags: ["vorbereitung", "saison", "training"],
      createdAt: dayjs().toISOString(),
      updatedAt: dayjs().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "article" as const,
      title: "Erfolgreiche Saison 2023/24 abgeschlossen",
      slug: "erfolgreiche-saison-2023-24",
      content:
        "<p>Die vergangene Saison war geprägt von großartigen Leistungen aller Mannschaften. Wir freuen uns auf neue Herausforderungen in der nächsten Saison.</p>",
      excerpt: "Rückblick auf eine erfolgreiche Saison",
      status: "archived" as const,
      imageS3Keys: [],
      tags: ["archiv", "saison", "2023-2024"],
      createdAt: dayjs().subtract(200, "days").toISOString(),
      updatedAt: dayjs().subtract(200, "days").toISOString(),
    },
    {
      id: crypto.randomUUID(),
      type: "article" as const,
      title: "Benefizturnier für den guten Zweck",
      slug: "benefizturnier-guter-zweck",
      content:
        "<p>Dieses Jahr veranstalten wir ein Benefizturnier, bei dem alle Einnahmen an ein lokales Kinderheim gehen. Kommt alle vorbei und unterstützt einen guten Zweck!</p><p>Das Turnier findet am 15. Juni statt. Anmeldungen ab sofort möglich.</p>",
      excerpt: "Großes Benefizturnier für den guten Zweck",
      status: "published" as const,
      imageS3Keys: [],
      tags: ["benefiz", "turnier", "spenden"],
      createdAt: dayjs().subtract(45, "days").toISOString(),
      updatedAt: dayjs().subtract(45, "days").toISOString(),
    },
  ];

  const validatedArticles = articles.map((article) => newsSchema.parse(article));

  const imageUrlSets = [
    ["https://picsum.photos/1200/800?random=20", "https://picsum.photos/1200/800?random=21"],
    ["https://picsum.photos/1200/800?random=22"],
    [
      "https://picsum.photos/1200/800?random=23",
      "https://picsum.photos/1200/800?random=24",
      "https://picsum.photos/1200/800?random=25",
    ],
    [],
    ["https://picsum.photos/1200/800?random=26"],
    ["https://picsum.photos/1200/800?random=27", "https://picsum.photos/1200/800?random=28"],
  ];

  console.log("  Downloading and uploading news images...");
  for (let i = 0; i < validatedArticles.length; i++) {
    const imageUrls = imageUrlSets[i] || [];
    for (const imageUrl of imageUrls) {
      try {
        const uploadKey = `uploads/news/${validatedArticles[i].id}-${imageUrls.indexOf(imageUrl)}.jpg`;
        const finalKey = `news/${validatedArticles[i].id}-${imageUrls.indexOf(imageUrl)}.jpg`;
        await uploadImageToS3(ctx, imageUrl, uploadKey);
        validatedArticles[i].imageS3Keys?.push(finalKey);
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(
          `  ⚠️  Failed to upload image for article ${validatedArticles[i].title}:`,
          error,
        );
      }
    }
  }

  await putItems(ctx.entities.news, validatedArticles);
  console.log(`✅ Seeded ${validatedArticles.length} news articles`);
}
