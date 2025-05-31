"use client";

const COOLIFY_URL = process.env.COOLIFY_URL;

export default function myImageLoader({ src, width, quality }) {
	if (!COOLIFY_URL) return src;

	const isLocal = !src.startsWith("http");
	const query = new URLSearchParams();

	const imageOptimizationApi = "https://nit.terijaki.eu";
	// Your NextJS application URL
	const baseUrl = `https://${COOLIFY_URL}`; // this is the domain configured in coolify

	const fullSrc = `${baseUrl}${src}`;

	if (width) query.set("width", width);
	if (quality) query.set("quality", quality);

	if (isLocal && process.env.NODE_ENV === "development") {
		return src;
	}
	if (isLocal) {
		return `${imageOptimizationApi}/image/${fullSrc}?${query.toString()}`;
	}
	return `${imageOptimizationApi}/image/${src}?${query.toString()}`;
}
