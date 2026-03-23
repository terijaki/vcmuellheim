import babel from "@rolldown/plugin-babel";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { getSanitizedBranch } from "../../utils/git";
import { getAppEnvironment, localAwsResourceEnvPlugin } from "./vite/localAwsResourceEnv";

const sanitizedBranch = getSanitizedBranch();

export default defineConfig(({ mode }) => {
	const isProd = getAppEnvironment(mode) === "prod";

	return {
		plugins: [
			localAwsResourceEnvPlugin(),
			nitro({
				preset: "aws-lambda",
				output: {
					publicDir: ".output/public",
					serverDir: ".output/server",
				},
			}),
			tanstackStart(),
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
		resolve: {
			tsconfigPaths: true,
		},
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
	};
});
