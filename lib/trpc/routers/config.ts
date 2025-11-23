/**
 * Public configuration endpoint
 * Returns environment-specific config needed by the CMS
 */
import { publicProcedure, router } from "../trpc";

export const configRouter = router({
	/**
	 * Get Cognito configuration for authentication
	 * This is public since Client ID is not sensitive
	 */
	cognito: publicProcedure.query(async () => {
		return {
			region: process.env.AWS_REGION || "eu-central-1",
			userPoolId: process.env.COGNITO_USER_POOL_ID,
			clientId: process.env.COGNITO_USER_POOL_CLIENT_ID,
		};
	}),

	/**
	 * Get API metadata
	 */
	info: publicProcedure.query(async () => {
		return {
			environment: process.env.CDK_ENVIRONMENT || "dev",
			version: process.env.npm_package_version || "unknown",
			region: process.env.AWS_REGION || "eu-central-1",
		};
	}),
});
