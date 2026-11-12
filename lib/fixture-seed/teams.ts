import dayjs from "dayjs";
import { teamSchema } from "@/lib/db/schemas";
import { slugify } from "@/utils/slugify";
import { putItems, type SeedContext, uploadSeedAssetToS3 } from "./common";
import { TEAM_PHOTO_ASSETS } from "./seed-assets";

export async function seedTeamsData(ctx: SeedContext): Promise<void> {
  console.log("\n🏐 Seeding teams...");

  const teams = [
    {
      name: "Herren 1",
      description: "Erste Herrenmannschaft in der Landesliga",
      gender: "male" as const,
      ageGroup: "ab 16",
      league: "Landesliga",
      trainerIds: [ctx.membersCache[0]?.id, ctx.membersCache[1]?.id].filter(Boolean),
      pointOfContactIds: [ctx.membersCache[3]?.id].filter(Boolean),
      pictureS3Keys: [],
      trainingSchedules: [
        {
          days: [1, 3, 5],
          startTime: "19:00",
          endTime: "21:00",
          locationId: (ctx.locationCache[0]?.id ?? crypto.randomUUID()) as string,
        },
      ],
    },
    {
      name: "Damen 1",
      description: "Erste Damenmannschaft in der Oberliga",
      gender: "female" as const,
      ageGroup: "18",
      league: "Oberliga",
      trainerIds: [ctx.membersCache[1]?.id].filter(Boolean),
      pointOfContactIds: [ctx.membersCache[2]?.id].filter(Boolean),
      pictureS3Keys: [],
      trainingSchedules: [
        {
          days: [2, 4, 6],
          startTime: "19:30",
          endTime: "21:30",
          locationId: (ctx.locationCache[1]?.id ?? crypto.randomUUID()) as string,
        },
      ],
    },
    {
      name: "Jugend",
      description: "Jugendmannschaft U18",
      gender: "mixed" as const,
      ageGroup: "12-18 Jahre",
      pointOfContactIds: [ctx.membersCache[3]?.id].filter(Boolean),
      trainingSchedules: [
        {
          days: [1, 4],
          startTime: "17:00",
          endTime: "18:30",
          locationId: (ctx.locationCache[2]?.id ?? crypto.randomUUID()) as string,
        },
      ],
    },
    {
      name: "Damen 2",
      description: "Zweite Damenmannschaft",
      gender: "female" as const,
      league: "Verbandsliga",
      trainerIds: [ctx.membersCache[5]?.id].filter(Boolean),
      trainingSchedules: [
        {
          days: [2, 5],
          startTime: "20:00",
          endTime: "22:00",
          locationId: (ctx.locationCache[0]?.id ?? crypto.randomUUID()) as string,
        },
      ],
    },
  ];

  const teamsWithBaseMeta = teams.map((t) => ({
    ...t,
    type: "team" as const,
    id: crypto.randomUUID(),
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    slug: slugify(t.name, true),
  }));

  const validatedTeams = teamsWithBaseMeta.map((team) => teamSchema.parse(team));

  const teamPictureCounts = [1, 1, 0, 0];

  console.log("  Uploading team pictures...");
  for (let i = 0; i < validatedTeams.length; i++) {
    validatedTeams[i].pictureS3Keys = [];
    const teamAsset = TEAM_PHOTO_ASSETS[i];
    for (let pictureIndex = 0; pictureIndex < (teamPictureCounts[i] ?? 0); pictureIndex++) {
      try {
        const finalKey = `teams/${validatedTeams[i].id}-${pictureIndex}.jpg`;
        if (!teamAsset) {
          throw new Error("Missing team photo fixture asset");
        }
        await uploadSeedAssetToS3(ctx, teamAsset, finalKey);
        validatedTeams[i].pictureS3Keys?.push(finalKey);
      } catch (error) {
        console.warn(`  ⚠️  Failed to upload picture for team ${validatedTeams[i].name}:`, error);
      }
    }
  }

  await putItems(ctx.entities.team, validatedTeams);
  console.log(`✅ Seeded ${validatedTeams.length} teams`);
  ctx.teamCache.push(...validatedTeams);
}
