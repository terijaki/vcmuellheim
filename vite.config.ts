import { defineConfig } from "vite-plus";

export default defineConfig({
	staged: {
		"*": "vp check --fix",
	},
	fmt: {
		ignorePatterns: [".vscode/**", "apps/webapp/src/routeTree.gen.ts", "codegen/sams/generated/**"],
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
		tsconfigPaths: true,
	},
	test: {
		setupFiles: ["./test-setup.ts"],
		sequence: {
			shuffle: true,
		},
	},
});
