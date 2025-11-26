import path from "node:path";
import tanstackRouter from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { getSanitizedBranch } from "../../utils/git";

const sanitizedBranch = getSanitizedBranch();

export default defineConfig({
	plugins: [tanstackRouter(), react()],
	define: {
		// Inject Git branch at build time
		"import.meta.env.VITE_GIT_BRANCH": JSON.stringify(sanitizedBranch),
	},
	resolve: {
		alias: {
			"@lib": path.resolve(__dirname, "../../lib"),
			"@utils": path.resolve(__dirname, "../../utils"),
			"@data": path.resolve(__dirname, "../../data"),
		},
	},
	server: {
		port: 3081,
	},
	build: {
		outDir: "dist",
		sourcemap: true,
	},
});
