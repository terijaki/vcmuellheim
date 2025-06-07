import { withPayload } from "@payloadcms/next/withPayload";
import withPlaiceholder from "@plaiceholder/next";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	images: {
		loader: process.env.COOLIFY_URL ? "custom" : undefined,
		loaderFile: process.env.COOLIFY_URL ? "./loader.js" : undefined,
		formats: ["image/avif", "image/webp"],
		minimumCacheTTL: 1209600, // 14 days
		remotePatterns: [
			{
				protocol: "https",
				hostname: "dvv.sams-server.de",
				port: "",
				pathname: "/uploads/**",
			},
			{
				protocol: "https",
				hostname: "volleyball-baden.de",
				port: "",
				pathname: "/uploads/**",
			},
			{
				protocol: "https",
				hostname: "**.volleyball-baden.de",
				port: "",
				pathname: "/uploads/**",
			},
			{
				protocol: "https",
				hostname: "**.cdninstagram.com",
				port: "",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "**.fbcdn.net",
				port: "",
				pathname: "/**",
			},
		],
	},
	rewrites: async () => {
		return [
			{
				source: "/rss",
				destination: "/rss/xml",
			},
			{
				source: "/rss.xml",
				destination: "/rss/xml",
			},
			{
				source: "/atom.xml",
				destination: "/rss/atom",
			},
			{
				source: "/rss.json",
				destination: "/rss/json",
			},
			{
				source: "/logo",
				destination: "/brand",
			},
			{
				source: "/login",
				destination: "/admin",
			},
			{
				source: "/edit",
				destination: "/admin",
			},
		];
	},
	experimental: {
		useCache: true,
		optimizePackageImports: ["@mantine/core"],
	},
};
export default withSentryConfig(withPayload(withPlaiceholder(nextConfig)), {
	org: "volleyballclub-mullheim-ev",
	project: "volleyball-website",
	telemetry: false,
	widenClientFileUpload: true, // Upload a larger set of source maps for prettier stack traces (increases build time)
	disableLogger: true, // Automatically tree-shake Sentry logger statements to reduce bundle size
});
