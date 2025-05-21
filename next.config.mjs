import { withPayload } from "@payloadcms/next/withPayload";
// @ts-check
import withPlaiceholder from "@plaiceholder/next";

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
	output: "standalone",
	images: {
		loader: process.env.COOLIFY_URL ? "custom" : undefined,
		loaderFile: process.env.COOLIFY_URL ? "./loader.js" : undefined,
		formats: ["image/avif", "image/webp"],
		minimumCacheTTL: 1209600, // 14 days
		remotePatterns: [
			{
				protocol: "https",
				hostname: "volleyball-baden.de",
				port: "",
				pathname: "/uploads/**",
			},
			{
				protocol: "https",
				hostname: "www.volleyball-baden.de",
				port: "",
				pathname: "/uploads/**",
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
		];
	},
	experimental: {
		useCache: true,
	},
};
export default withPayload(withPlaiceholder(nextConfig));
