/**
 * Responsive image component with lazy loading and multiple size variants
 * Uses Mantine Image component with srcSet for responsive serving
 * Works with both S3 keys and CloudFront URLs
 */

import { Image, type ImageProps } from "@mantine/core";
import { useFileUrl } from "../lib/hooks";
import { buildSizesAttribute, buildSrcSet } from "../lib/image-config";

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
	let parsedUrl: URL;

	try {
		parsedUrl = new URL(baseUrl);
	} catch {
		return null;
	}

	// Signed S3 URLs contain query parameters, so responsive variants cannot be derived safely.
	if (parsedUrl.search || parsedUrl.hash) {
		return null;
	}

	const pathnameParts = parsedUrl.pathname.split("/");
	const filename = pathnameParts.pop();
	if (!filename) {
		return null;
	}

	const withoutSuffix = filename.replace(/-(480w|800w|1200w)(\.[^.]+)?$/i, "");
	const baseFilename = withoutSuffix.replace(/\.[^.]+$/, "");
	const folderPath = pathnameParts.join("/");
	const folder = `${parsedUrl.origin}${folderPath}`;

	return {
		original: baseUrl,
		sm: `${folder}/${baseFilename}-480w.jpg`,
		md: `${folder}/${baseFilename}-800w.jpg`,
		lg: `${folder}/${baseFilename}-1200w.jpg`,
		smWebp: `${folder}/${baseFilename}-480w.webp`,
		mdWebp: `${folder}/${baseFilename}-800w.webp`,
		lgWebp: `${folder}/${baseFilename}-1200w.webp`,
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

	const { data: baseUrl } = useFileUrl(isS3Key ? source : undefined);

	// Determine final URL and variants
	const finalUrl = isS3Key ? baseUrl : source;
	const urlVariants = finalUrl ? buildUrlVariants(finalUrl) : null;

	if (!finalUrl) {
		return null;
	}

	const jpegSrcSet = urlVariants ? buildSrcSet({ sm: urlVariants.sm, md: urlVariants.md, lg: urlVariants.lg }) : undefined;
	const webpSrcSet = urlVariants ? buildSrcSet({ sm: urlVariants.smWebp, md: urlVariants.mdWebp, lg: urlVariants.lgWebp }) : undefined;
	const sizes = jpegSrcSet ? buildSizesAttribute("quarter") : undefined;

	return (
		<picture>
			{webpSrcSet && <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />}
			<Image src={finalUrl} srcSet={jpegSrcSet} sizes={sizes} alt={alt} loading={lazy ? "lazy" : "eager"} style={{ width: "100%", height: "100%", objectFit: "cover" }} {...props} />
		</picture>
	);
};

export default ResponsiveImage;
