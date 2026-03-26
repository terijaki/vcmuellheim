import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

const repoRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
	staged: {
		"*": "vp check --fix",
	},
	fmt: {
		ignorePatterns: [
			".vscode/**",
			"apps/webapp/src/routeTree.gen.ts",
			"codegen/sams/generated/**",
			".github/skills/sams-api/API-OVERVIEW.md",
			".github/skills/sams-api/BUGS.md",
			".github/skills/sams-api/SKILL.md",
			".github/workflows/sams-health-check.yml",
		],
		useTabs: true,
		tabWidth: 2,
		printWidth: 200,
		singleQuote: false,
	},
	lint: {
		ignorePatterns: [".vscode/**", "codegen/sams/generated/**", "apps/webapp/src/routeTree.gen.ts"],
		plugins: ["react"],
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
	resolve: {
		alias: {
			"@": repoRoot,
			"@codegen": `${repoRoot}codegen`,
			"@project.config": `${repoRoot}project.config.ts`,
			"@webapp": `${repoRoot}apps/webapp/src`,
			"@lib": `${repoRoot}lib`,
			"@lambda": `${repoRoot}lambda`,
			"@utils": `${repoRoot}utils`,
			"@data": `${repoRoot}data`,
		},
	},
	test: {
		setupFiles: ["./test-setup.ts"],
		sequence: {
			shuffle: true,
		},
	},
});
