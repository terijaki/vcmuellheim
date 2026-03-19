import { Club } from "@project.config";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const baseURL = typeof window === "undefined" ? process.env.BETTER_AUTH_URL || process.env.CLOUDFRONT_URL || `https://${Club.domain}` : undefined;

export const authClient = createAuthClient({
	baseURL,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [emailOTPClient()],
});
