import { runFixtureSeed } from "@webapp/server/seed/run-fixture-seed.server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authorizeFeatureBranchSeed } from "@/utils/seed-access";

const seedRequestBodySchema = z
  .object({
    adminEmail: z.string().trim().toLowerCase().pipe(z.email()).optional(),
  })
  .optional()
  .default({});

export const Route = createFileRoute("/api/dev/seed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const access = authorizeFeatureBranchSeed({
          environment: process.env.CDK_ENVIRONMENT,
          branchName: process.env.BRANCH_NAME,
          authorizationHeader: request.headers.get("authorization"),
        });
        if (!access.ok) {
          return new Response(access.status === 401 ? "Unauthorized" : null, {
            status: access.status,
          });
        }

        let adminEmail: string | undefined;
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          try {
            const raw: unknown = await request.json();
            const parsed = seedRequestBodySchema.safeParse(raw);
            if (!parsed.success) {
              return new Response("Invalid seed request body\n", { status: 400 });
            }
            adminEmail = parsed.data.adminEmail;
          } catch {
            return new Response("Invalid JSON body\n", { status: 400 });
          }
        }

        try {
          await runFixtureSeed(adminEmail ? { adminEmail } : undefined);
          return new Response("Database seeding completed successfully\n", {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        } catch (error) {
          console.error(error);
          return new Response("Seed failed\n", { status: 500 });
        }
      },
    },
  },
});
