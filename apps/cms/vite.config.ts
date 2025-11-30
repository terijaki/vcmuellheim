import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tanstackRouter from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { getSanitizedBranch } from "../../utils/git";

const sanitizedBranch = getSanitizedBranch();

export default defineConfig({
	plugins: [
		tanstackRouter(),
		react({
			babel: {
				plugins: ["babel-plugin-react-compiler"],
			},
		}),
		sentryVitePlugin({
			org: "volleyballclub-mullheim-ev",
			project: "volleyball-website",
			disable: !process.env.SENTRY_AUTH_TOKEN,
			authToken: process.env.SENTRY_AUTH_TOKEN,
			telemetry: process.env.VITE_CDK_ENVIRONMENT === "prod",
			silent: process.env.VITE_CDK_ENVIRONMENT !== "prod",
		}),
	],
	define: {
		// Inject Git branch at build time
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
			"@apps/shared": path.resolve(__dirname, "../shared"),
		},
	},
	server: {
		port: 3081,
	},
	build: {
		outDir: "dist",
		sourcemap: true,
		assetsInlineLimit: 0,
	},
	publicDir: "public",
});
