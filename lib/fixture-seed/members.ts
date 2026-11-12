import dayjs from "dayjs";
import { memberSchema } from "@/lib/db/schemas";
import { putItems, type SeedContext, uploadSeedAssetToS3 } from "./common";
import { SEED_ASSET_FILES } from "./seed-assets";

export async function seedMembersData(ctx: SeedContext): Promise<void> {
  console.log("\n👥 Seeding members...");

  const members = [
    {
      name: "Max Müller",
      email: "max.mueller@example.com",
      phone: "+49 7622 123456",
      isBoardMember: true,
      isTrainer: true,
      roleTitle: "Trainer Herren 1",
      avatarS3Key: "",
    },
    {
      name: "Sarah Hubertschmidt",
      email: "sarah.hubertschmidt@example.com",
      phone: "+49 7622 234567",
      isBoardMember: true,
      isTrainer: true,
      roleTitle: "Trainerin Damen 1",
      avatarS3Key: "",
    },
    {
      name: "Thomas Weber",
      email: "thomas.weber@example.com",
      phone: "+49 7622 345678",
      isBoardMember: true,
      roleTitle: "Kassier",
      createdAt: dayjs().subtract(2, "years").toISOString(),
    },
    {
      name: "Julia Fischer",
      email: "julia.fischer@example.com",
      isBoardMember: false,
      isTrainer: true,
      roleTitle: "Trainerin Jugend",
      avatarS3Key: "",
    },
    {
      name: "Klaus Hoffmann",
      email: "klaus.hoffmann@example.com",
      isBoardMember: false,
      isTrainer: false,
      roleTitle: "Schiedsrichter",
    },
    {
      name: "Anna-Maria Sofie Wagner",
      email: "anna.maria.sofie.wagner@example.com",
      isBoardMember: false,
      isTrainer: true,
      roleTitle: "Co-Trainer Damen 2",
      avatarS3Key: "",
    },
    {
      name: "Peter Lustig",
      email: "peter.lustig@example.com",
      isBoardMember: false,
      isTrainer: true,
      roleTitle: "Mitgliederverwaltung",
    },
  ];

  const membersWithBaseMeta = members.map((m) => ({
    id: crypto.randomUUID(),
    createdAt: dayjs().toISOString(),
    updatedAt: dayjs().toISOString(),
    ...m,
  }));

  const validatedMembers = membersWithBaseMeta.map((mem) => memberSchema.parse(mem));

  console.log("  Uploading member avatars...");
  for (let i = 0; i < validatedMembers.length; i++) {
    const member = validatedMembers[i];
    if (i === 0 || i === 1 || i === 3 || i === 5) {
      try {
        const finalKey = `members/${member.id}-avatar.jpg`;
        await uploadSeedAssetToS3(ctx, SEED_ASSET_FILES.portrait, finalKey);
        member.avatarS3Key = finalKey;
      } catch (error) {
        console.warn(`  ⚠️  Failed to upload avatar for member ${member.name}:`, error);
      }
    }
  }

  await putItems(ctx.entities.member, validatedMembers);
  console.log(`✅ Seeded ${validatedMembers.length} members`);

  ctx.membersCache.push(...validatedMembers);
}
