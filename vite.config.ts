import babel from "@rolldown/plugin-babel";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite-plus";
import { getSanitizedBranch } from "./utils/git.ts";
import { getAppEnvironment, localAwsResourceEnvPlugin } from "./apps/webapp/vite/localAwsResourceEnv.ts";

const sanitizedBranch = getSanitizedBranch();
const isProd = getAppEnvironment() === "prod";

export default defineConfig({
	staged: {
		"*": "vp check --fix",
	},
	fmt: {
		ignorePatterns: ["apps/webapp/src/routeTree.gen.ts", "codegen/sams/generated/**"],
		useTabs: true,
		tabWidth: 2,
		printWidth: 200,
	},
	lint: {
		ignorePatterns: ["codegen/sams/generated/**", "apps/webapp/src/routeTree.gen.ts"],
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
				publicDir: ".output/public",
				serverDir: ".output/server",
			},
		}),
		tanstackStart({ srcDirectory: "apps/webapp/src" }),
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
	define: {
		// Inject Git branch at build time for service URL resolution
		"import.meta.env.VITE_GIT_BRANCH": JSON.stringify(sanitizedBranch),
	},
	publicDir: "apps/webapp/public",
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		root: ".",
		setupFiles: ["./test-setup.ts"],
		sequence: {
			shuffle: true,
		},
	},
});
