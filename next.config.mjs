// @ts-check
import withPlaiceholder from "@plaiceholder/next";

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  output: "standalone",
  images: {
    loader: 'custom',
    loaderFile: './loader.js',
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 36000,
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
  experimental: {
    useCache: true,
  },
};
export default withPlaiceholder(nextConfig);
