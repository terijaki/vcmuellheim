import { defineConfig, lazyPlugins } from "vite-plus";
import { localAwsResourceEnvPlugin } from "./app/vite/localAwsResourceEnv.ts";

const isProd = process.env.CDK_ENVIRONMENT === "prod";
const isTest = process.env.VITEST === "true";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: ["app/src/routeTree.gen.ts", "env.d.ts"],
  },
  lint: {
    ignorePatterns: ["app/src/routeTree.gen.ts", "app/server/aws-lambda-sentry-entry.ts"],
    plugins: ["react"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  plugins: lazyPlugins(async () => {
    const [{ tanstackStart }, reactModule] = await Promise.all([
      import("@tanstack/react-start/plugin/vite"),
      import("@vitejs/plugin-react"),
    ]);
    const react = reactModule.default;

    if (isTest) {
      return [localAwsResourceEnvPlugin(), tanstackStart({ srcDirectory: "app/src" }), react()];
    }

    const [{ nitro }, babelModule, { sentryTanstackStart }] = await Promise.all([
      import("nitro/vite"),
      import("@rolldown/plugin-babel"),
      import("@sentry/tanstackstart-react/vite"),
    ]);

    return [
      localAwsResourceEnvPlugin(),
      nitro({
        preset: "aws-lambda",
        entry: "./app/server/aws-lambda-sentry-entry.ts",
        awsLambda: {
          streaming: true,
        },
        traceDeps: ["@sentry/aws-serverless"],
        output: {
          publicDir: "app/.output/public",
          serverDir: "app/.output/server",
        },
        // Keep AWS SDK v3 packages external to avoid broken transformed chunks in Lambda runtime.
        rollupConfig: {
          external: [/^@aws-sdk\//],
        },
        rolldownConfig: {
          external: [/^@aws-sdk\//],
        },
        hooks: {
          "rollup:before"(nitro, rollupConfig) {
            // Preset appends "-streaming" to the entry path; our custom entry already stream-wraps the handler.
            // Breaking Nitro preset changes are caught by scripts/verify-webapp-lambda-output.ts (CI + WebAppStack build).
            rollupConfig.input = nitro.options.entry;
          },
        },
        publicAssets: [{ dir: "app/public", maxAge: 0 }],
        serverAssets: [{ baseName: "fixture-seed", dir: "./app/public/fixture-seed" }],
      }),
      tanstackStart({ srcDirectory: "app/src" }),
      react(),
      babelModule.default({ presets: [reactModule.reactCompilerPreset()] }),
      sentryTanstackStart({
        org: "volleyballclub-mullheim-ev",
        project: "volleyball-website",
        sentryUrl: "https://de.sentry.io",
        authToken: process.env.SENTRY_AUTH_TOKEN,
        silent: !isProd,
      }),
    ];
  }),
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
    testTimeout: 30_000,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    reporters: process.env.GITHUB_ACTIONS === "true" ? ["agent", "github-actions"] : ["agent"],
    env: {
      // Suppress jsii deprecation warnings from aws-cdk-lib
      JSII_DEPRECATED: "quiet",
      CONTENT_TABLE_NAME: "test-content-table",
      SAMS_TABLE_NAME: "test-sams-table",
      SOCIAL_TABLE_NAME: "test-social-table",
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
        command: "bun run db:seed",
        dependsOn: ["deploy"],
        cache: false,
      },
    },
  },
});
