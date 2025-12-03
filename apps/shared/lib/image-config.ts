/**
 * Shared image configuration for responsive image processing
 * Used by both Lambda (image-processor) and frontend (ResponsiveImage, hooks)
 */

/** Maximum file size for image uploads (25 MB) */
export const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;

/** Maximum file size for compressed original image stored in S3 (5 MB) */
export const MAX_ORIGINAL_SIZE = 5 * 1024 * 1024;

/** Responsive image sizes in pixels */
export const IMAGE_SIZES = [480, 800, 1200] as const;

/** Type for image sizes */
export type ImageSize = (typeof IMAGE_SIZES)[number];

/** Image quality for JPEG and WebP output */
export const IMAGE_QUALITY = 85;

/** Image variant names (t-shirt sizes) for breakpoints */
export const IMAGE_VARIANTS = {
	sm: 480, // Small (480px)
	md: 800, // Medium (800px)
	lg: 1200, // Large (1200px)
} as const;

/** Type for image variant keys */
export type ImageVariantKey = keyof typeof IMAGE_VARIANTS;

/**  Get all image sizes including thumbnail, mobile, and desktop */
export const getImageSizes = (): readonly ImageSize[] => IMAGE_SIZES;

/** Build srcSet string from base URL and variant URLs. Example: "`url-480w.jpg 480w, url-800w.jpg 800w, url-1200w.jpg 1200w`" */
export const buildSrcSet = (variants: Record<ImageVariantKey, string>): string => {
	return `
		${variants.sm} 480w,
        ${variants.md} 800w,
		${variants.lg} 1200w
	`;
};

/** Build sizes attribute for responsive images. Example: "`(max-width: 480px) 100vw, (max-width: 800px) 100vw, 1200px`" */
export const buildSizesAttribute = (mobileView: "full" | "half" | "quarter" = "full"): string => {
	const baseSize = {
		full: "100vw",
		half: "50vw",
		quarter: "25vw",
	}[mobileView];

	return `(max-width: 480px) ${baseSize}, (max-width: 800px) ${baseSize}, 1200px`;
};

/**
 * Get image sizes as a mutable array (useful for passing to functions that expect number[])
 */
export const getImageSizesArray = (): number[] => [...IMAGE_SIZES];

/** Convert bytes to MB with 1 decimal place */
export const bytesToMB = (bytes: number, decimals: number = 1): string => {
	return (bytes / 1024 / 1024).toFixed(decimals);
};
