import path from "node:path";
import tanstackRouter from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [tanstackRouter(), react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
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
