import path from "node:path";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tanstackRouter from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { getSanitizedBranch } from "../../utils/git";

const sanitizedBranch = getSanitizedBranch();
const isProd = process.env.VITE_CDK_ENVIRONMENT === "prod";

export default defineConfig({
	plugins: [
		tanstackRouter({
			autoCodeSplitting: true,
		}),
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
			silent: !isProd,
			telemetry: true,
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
		port: 3080,
	},
	build: {
		outDir: "dist",
		sourcemap: true,
		assetsInlineLimit: 0,
		minify: "terser",
		rollupOptions: {
			output: {
				manualChunks: {
					"vendor-mantine": ["@mantine/core", "@mantine/hooks", "@mantine/dates"],
					"vendor-icons": ["lucide-react", "react-icons"],
					"vendor-trpc": ["@trpc/client", "@trpc/tanstack-react-query", "@tanstack/react-query"],
					"vendor-router": ["@tanstack/react-router"],
				},
			},
			treeshake: {
				moduleSideEffects: false,
				propertyReadSideEffects: false,
				tryCatchDeoptimization: false,
			},
		},
		chunkSizeWarningLimit: 500,
	},
	publicDir: "public",
});
