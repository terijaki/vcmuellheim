import babel from "@rolldown/plugin-babel";
import { varlockVitePlugin } from "@varlock/vite-integration";
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
    ignorePatterns: ["app/src/routeTree.gen.ts", "codegen/sams/generated/**", "env.d.ts"],
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
    varlockVitePlugin(),
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
    sentryTanstackStart({
      org: "volleyballclub-mullheim-ev",
      project: "volleyball-webapp",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !isProd,
    }),
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
    silent: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    reporters: process.env.GITHUB_ACTIONS === "true" ? ["agent", "github-actions"] : ["agent"],
    env: {
      // Suppress Powertools structured log output during tests
      POWERTOOLS_LOG_LEVEL: "SILENT",
      // Suppress jsii deprecation warnings from aws-cdk-lib
      JSII_DEPRECATED: "quiet",
      CONTENT_TABLE_NAME: "test-content-table",
      SAMS_TABLE_NAME: "test-sams-table",
      APP_BASE_URL: "https://test.vcmuellheim.de",
    },
  },
  run: {
    tasks: {
      // CDK deploy guarded by full check + tests
      deploy: {
        command: "bun run cdk:deploy:all",
        dependsOn: ["lint", "test"],
        cache: false,
      },
      // Database seeding script
      seed: {
        command: "bun run db:seed",
        dependsOn: ["lint", "test"],
        cache: false,
      },
      "seed-sams": {
        command: "bun run db:seed:sams",
        cache: false,
      },
      // Deploy + seed in one command for new branches
      "deploy-seeded": {
        command: "vpr seed",
        dependsOn: ["deploy"],
        cache: false,
      },
    },
  },
});
