import babel from "@rolldown/plugin-babel";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";
import { getAppEnvironment, localAwsResourceEnvPlugin } from "./app/vite/localAwsResourceEnv.ts";

const isProd = getAppEnvironment() === "prod";

export default defineConfig({
	staged: {
		"*": "vp check --fix",
	},
	fmt: {
		ignorePatterns: ["app/src/routeTree.gen.ts", "codegen/sams/generated/**"],
		useTabs: true,
		tabWidth: 2,
		printWidth: 200,
	},
	lint: {
		ignorePatterns: ["codegen/sams/generated/**", "app/src/routeTree.gen.ts"],
		plugins: ["react"],
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
	plugins: [
		localAwsResourceEnvPlugin(),
		nitro({
			preset: "aws-lambda",
			output: {
				publicDir: "app/.output/public",
				serverDir: "app/.output/server",
			},
			publicAssets: [{ dir: "app/public", maxAge: 0 }],
		}),
		tanstackStart({ srcDirectory: "app/src" }),
		react(),
		babel({ presets: [reactCompilerPreset()] }),
		...(process.env.SENTRY_AUTH_TOKEN
			? sentryTanstackStart({
					org: "volleyballclub-mullheim-ev",
					project: "volleyball-webapp",
					authToken: process.env.SENTRY_AUTH_TOKEN,
					silent: !isProd,
				})
			: []),
	],
	build: {
		sourcemap: true,
	},
	server: {
		port: 3080,
		forwardConsole: {
			unhandledErrors: true,
			logLevels: ["warn", "error"],
		},
	},
	publicDir: "app/public",
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		root: ".",
		setupFiles: ["./utils/test-setup.ts"],
		silent: true,
		reporters: process.env.GITHUB_ACTIONS === "true" ? ["agent", "github-actions"] : ["agent"],
	},
});
