"use client";

export default function myImageLoader({ src, width, quality }) {
  const isLocal = !src.startsWith("http");
  const query = new URLSearchParams();

  const imageOptimizationApi = "https://nit.terijaki.eu";
  // Your NextJS application URL
  const baseUrl = process.env.COOLIFY_URL;

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
