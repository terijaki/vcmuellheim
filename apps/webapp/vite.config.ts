import { sentryVitePlugin } from "@sentry/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { getSanitizedBranch } from "../../utils/git";

const sanitizedBranch = getSanitizedBranch();
const isProd = process.env.VITE_CDK_ENVIRONMENT === "prod";

export default defineConfig({
	plugins: [
		nitro({
			preset: "aws-lambda",
			output: {
				publicDir: ".output/public",
				serverDir: ".output/server",
			},
		}),
		tanstackStart(),
		tsconfigPaths(),
		react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
		sentryVitePlugin({
			org: "volleyballclub-mullheim-ev",
			project: "volleyball-webapp",
			disable: !process.env.SENTRY_AUTH_TOKEN,
			authToken: process.env.SENTRY_AUTH_TOKEN,
			silent: !isProd,
		}),
	],
	define: {
		// Inject Git branch at build time for service URL resolution
		"import.meta.env.VITE_GIT_BRANCH": JSON.stringify(sanitizedBranch),
	},
	build: {
		sourcemap: true,
	},
	server: {
		port: 3080,
	},
});
