#!/usr/bin/env bun

/**
 * Database seeding script for development/staging environments.
 * The actual seed logic lives in the scripts/seed directory.
 *
 * Usage:
 *   bun run db:seed                    # Seeds all entities
 *   bun run db:seed --reset            # Cleanup + seed all entities (CI / fresh branch env)
 *   bun run db:seed --cleanup          # Cleanup only (validates prod protection)
 *   bun run db:seed --cleanup --members  # Cleanup + seed members
 *   bun run db:seed --events           # Seeds only events
 *   bun run db:seed --volunteer-events  # Seeds only volunteer events
 *   bun run db:seed --news             # Seeds only news articles
 *   bun run db:seed --members          # Seeds only members
 *   bun run db:seed --teams            # Seeds only teams
 *   bun run db:seed --locations        # Seeds only locations
 *   bun run db:seed --sponsors         # Seeds only sponsors
 *   bun run db:seed --bus              # Seeds only bus bookings
 *   bun run db:seed --user email@example.com  # Grant Admin role to a member (creates minimal member if not found)
 */

import "varlock/auto-load";
import { createSeedContext, cleanupDatabase, createCmsUser } from "./seed/common";
import { seedBusData } from "./seed/bus";
import { seedEventsData } from "./seed/events";
import { seedVolunteerEventsData } from "./seed/volunteer-events";
import { seedLocationsData } from "./seed/locations";
import { seedMembersData } from "./seed/members";
import { seedNewsData } from "./seed/news";
import { seedSponsorsData } from "./seed/sponsors";
import { seedTeamsData } from "./seed/teams";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const cleanupOnly = args.includes("--cleanup") && args.length === 1 && !reset;
const shouldCleanup = args.includes("--cleanup") || reset;

const seedAll = args.length === 0 || reset;
const seedEvents = seedAll || args.includes("--events");
const seedVolunteerEvents = seedAll || args.includes("--volunteer-events");
const seedNews = seedAll || args.includes("--news");
const seedMembers = seedAll || args.includes("--members");
const seedTeams = seedAll || args.includes("--teams");
const seedLocations = seedAll || args.includes("--locations");
const seedSponsors = seedAll || args.includes("--sponsors");
const seedBus = seedAll || args.includes("--bus");

// Handle --user argument (email only — passwordless OTP authentication)
const userArgIndex = args.indexOf("--user");
const shouldCreateUser = userArgIndex !== -1;
let userEmail: string | undefined;

if (shouldCreateUser) {
  const email = args[userArgIndex + 1];
  if (!email || email.startsWith("--")) {
    console.error("❌ Email address required. Use: --user email@example.com");
    process.exit(1);
  }
  userEmail = email;
}

const ctx = createSeedContext();

async function main() {
  try {
    if (shouldCreateUser && userEmail) {
      await createCmsUser(ctx, userEmail);
      return;
    }

    if (cleanupOnly) {
      await cleanupDatabase(ctx);
      return;
    }

    if (shouldCleanup) {
      await cleanupDatabase(ctx);
    }

    if (seedLocations) {
      await seedLocationsData(ctx);
    }

    if (seedMembers) {
      await seedMembersData(ctx);
    }

    if (seedTeams) {
      await seedTeamsData(ctx);
    }

    if (seedNews) {
      await seedNewsData(ctx);
    }

    if (seedSponsors) {
      await seedSponsorsData(ctx);
    }

    if (seedEvents) {
      await seedEventsData(ctx);
    }

    if (seedVolunteerEvents) {
      await seedVolunteerEventsData(ctx);
    }

    if (seedBus) {
      await seedBusData(ctx);
    }

    console.log("\n🎉 Database seeding completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Database seeding failed:", error);
    process.exit(1);
  }
}

main();
