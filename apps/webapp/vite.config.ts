import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { getSanitizedBranch } from "../../utils/git";

const sanitizedBranch = getSanitizedBranch();
const isProd = process.env.VITE_CDK_ENVIRONMENT === "prod";

export default defineConfig({
	plugins: [
		tanstackStart(),
		nitro({
			preset: "aws-lambda",
		}),
		react({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
		sentryVitePlugin({
			org: "volleyballclub-mullheim-ev",
			project: "volleyball-webapp",
			disable: !process.env.SENTRY_AUTH_TOKEN,
			authToken: process.env.SENTRY_AUTH_TOKEN,
			silent: !isProd,
			telemetry: true,
		}),
	],
	define: {
		// Inject Git branch at build time for service URL resolution
		"import.meta.env.VITE_GIT_BRANCH": JSON.stringify(sanitizedBranch),
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "../../"),
			"@lib": path.resolve(__dirname, "../../lib"),
			"@lambda": path.resolve(__dirname, "../../lambda"),
			"@utils": path.resolve(__dirname, "../../utils"),
			"@data": path.resolve(__dirname, "../../data"),
			"@codegen": path.resolve(__dirname, "../../codegen"),
			"@project.config": path.resolve(__dirname, "../../project.config.ts"),
		},
	},
	build: {
		sourcemap: true,
	},
	server: {
		port: 3080,
	},
});
