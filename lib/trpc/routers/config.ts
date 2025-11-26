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
		const hostedUiUrl = process.env.COGNITO_HOSTED_UI_URL;
		const clientId = process.env.COGNITO_USER_POOL_CLIENT_ID;
		const callbackUrl = process.env.CMS_CALLBACK_URL;

		return {
			region: process.env.AWS_REGION || "eu-central-1",
			userPoolId: process.env.COGNITO_USER_POOL_ID,
			clientId,
			// Hosted UI URLs
			hostedUi: hostedUiUrl
				? {
						baseUrl: hostedUiUrl,
						loginUrl: `${hostedUiUrl}/login?client_id=${clientId}&response_type=code&scope=email+openid+profile&redirect_uri=${encodeURIComponent(callbackUrl || "")}`,
						logoutUrl: `${hostedUiUrl}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(callbackUrl?.replace("/auth/callback", "/login") || "")}`,
					}
				: undefined,
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
