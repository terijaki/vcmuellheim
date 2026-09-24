import { runFixtureSeed } from "@webapp/server/seed/run-fixture-seed.server";
import { createFileRoute } from "@tanstack/react-router";
import { authorizeFeatureBranchSeed } from "@/utils/seed-access";

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

        try {
          await runFixtureSeed();
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
