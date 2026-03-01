import { publicProcedure, router } from "../trpc";

export const configRouter = router({
	/**
	 * Get API metadata
	 */
	info: publicProcedure.query(async () => {
		return {
			environment: process.env.CDK_ENVIRONMENT || "dev",
			version: process.env.npm_package_version || "unknown",
			region: process.env.AWS_REGION || "eu-central-1",
			authUrl: process.env.BETTER_AUTH_URL || "",
		};
	}),
});
