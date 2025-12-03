/**
 * Responsive image component with lazy loading and multiple size variants
 * Uses Mantine Image component with srcSet for responsive serving
 * Works with both S3 keys and CloudFront URLs
 */

import { Image, type ImageProps } from "@mantine/core";
import { buildSizesAttribute, buildSrcSet } from "@/apps/shared/lib/image-config";
import { useFileUrl, useImageVariants } from "../lib/hooks";

interface ResponsiveImageProps extends Omit<ImageProps, "src" | "srcSet"> {
	/** S3 key of the original image OR CloudFront URL */
	source: string;
	/** Alt text for accessibility */
	alt: string;
	/** Use lazy loading (default: true) */
	lazy?: boolean;
}

/**
 * Build variant URLs from a base URL by inserting size suffix before extension.*/
const buildUrlVariants = (baseUrl: string) => {
	// Extract base URL without filename
	const lastSlashIndex = baseUrl.lastIndexOf("/");
	const folder = baseUrl.substring(0, lastSlashIndex);
	const filename = baseUrl.substring(lastSlashIndex + 1);

	// Remove size suffix if present (e.g., -480w)
	const withoutSuffix = filename.replace(/-(480w|800w|1200w)(\.[^.]+)?$/i, "");
	const baseFilename = withoutSuffix.replace(/\.[^.]+$/, "");

	return {
		original: baseUrl,
		sm: `${folder}/${baseFilename}-480w.jpg`,
		md: `${folder}/${baseFilename}-800w.jpg`,
		lg: `${folder}/${baseFilename}-1200w.jpg`,
		webp: {
			sm: `${folder}/${baseFilename}-480w.webp`,
			md: `${folder}/${baseFilename}-800w.webp`,
			lg: `${folder}/${baseFilename}-1200w.webp`,
		},
	};
};

/**
 * ResponsiveImage component - unified for both article and gallery images
 * Automatically detects S3 key vs URL and generates appropriate srcSet
 *
 * Examples:
 * - S3 key: `<ResponsiveImage source="news/abc-123.jpg" alt="Article image" />`
 * - URL: `<ResponsiveImage source="https://media.example.com/news/abc-123.jpg" alt="Article image" />`
 */
export const ResponsiveImage = ({ source, alt, lazy = true, ...props }: ResponsiveImageProps) => {
	// Determine if source is an S3 key or a URL
	const isS3Key = !source.startsWith("http");

	// Only fetch variants if it's an S3 key
	const variants = useImageVariants(isS3Key ? source : undefined);
	const { data: baseUrl } = useFileUrl(isS3Key ? source : undefined);

	// Determine final URL and variants
	const finalUrl = isS3Key ? baseUrl : source;
	const urlVariants = !isS3Key ? buildUrlVariants(source) : null;

	if (!finalUrl) {
		return null;
	}

	let jpegVariants: Record<string, string>;
	let webpVariants: Record<string, string>;

	if (isS3Key && variants && baseUrl) {
		// S3 key path: use fetched variants with baseUrl
		jpegVariants = {
			sm: `${baseUrl}/${variants.sm}`,
			md: `${baseUrl}/${variants.md}`,
			lg: `${baseUrl}/${variants.lg}`,
		};
		webpVariants = {
			sm: `${baseUrl}/${variants.webp.sm}`,
			md: `${baseUrl}/${variants.webp.md}`,
			lg: `${baseUrl}/${variants.webp.lg}`,
		};
	} else if (urlVariants) {
		// URL path: use parsed variants
		jpegVariants = {
			sm: urlVariants.sm,
			md: urlVariants.md,
			lg: urlVariants.lg,
		};
		webpVariants = urlVariants.webp;
	} else {
		// Shouldn't reach here
		jpegVariants = { sm: finalUrl, md: finalUrl, lg: finalUrl };
		webpVariants = { sm: finalUrl, md: finalUrl, lg: finalUrl };
	}

	const jpegSrcSet = buildSrcSet(jpegVariants);
	const webpSrcSet = buildSrcSet(webpVariants);
	const sizes = buildSizesAttribute("quarter");

	return (
		<Image
			src={source}
			srcSet={webpSrcSet}
			fallbackSrc={jpegSrcSet}
			sizes={sizes}
			alt={alt}
			loading={lazy ? "lazy" : "eager"}
			style={{ width: "100%", height: "100%", objectFit: "cover" }}
			{...props}
		/>
	);
};

export default ResponsiveImage;
