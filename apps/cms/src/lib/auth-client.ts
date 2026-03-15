import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { buildServiceUrl } from "../../../shared";

export const authClient = createAuthClient({
	baseURL: buildServiceUrl("api", "/api/auth"),
	fetchOptions: {
		credentials: "include",
	},
	plugins: [emailOTPClient()],
});
