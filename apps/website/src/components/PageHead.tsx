import { Club } from "@project.config";
import { useLocation } from "@tanstack/react-router";
import { Helmet } from "react-helmet-async";

const DEFAULT_DESCRIPTION = "Willkommen beim Volleyballclub Müllheim e.V. - Dein Volleyballverein für alle Altersklassen mit Damen-, Herren- und Jugendteams.";
const DEFAULT_IMAGE = `${Club.url}/logos/logo-366273-500.png`;

export interface PageHeadProps {
	title?: string;
	description?: string;
	image?: string;
	type?: "website" | "article";
	publishedAt?: string;
	updatedAt?: string;
	author?: string;
}

/**
 * PageHead Component
 *
 * Manages meta tags for SEO and social sharing using React Helmet Async.
 * Automatically includes Open Graph tags, Twitter Card tags, and canonical URLs.
 * URL is automatically derived from the current route via React Router.
 *
 * @example
 * // For a news article
 * <PageHead
 *   title="Großes Turnier erfolgreich!"
 *   description="Unser Team gewinnt das Frühjahrsturnier"
 *   image={articleImage}
 *   type="article"
 *   publishedAt={article.createdAt}
 *   updatedAt={article.updatedAt}
 * />
 *
 * @example
 * // For a static page
 * <PageHead
 *   title="Unsere Teams"
 *   description="Hier findest du alle Informationen über unsere Volleyball-Teams"
 * />
 */
export default function PageHead({ title, description = DEFAULT_DESCRIPTION, image = DEFAULT_IMAGE, type = "website", publishedAt, updatedAt, author }: PageHeadProps) {
	const location = useLocation();
	const canonicalUrl = `${Club.url}${location.pathname}`;
	const fullTitle = title ? `${title} - ${Club.name}` : Club.name;

	return (
		<Helmet>
			{/* Basic Meta Tags */}
			<title>{fullTitle}</title>
			<meta name="description" content={description} />
			<meta name="charset" content="UTF-8" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />

			{/* Canonical URL - prevents duplicate content issues */}
			<link rel="canonical" href={canonicalUrl} />

			{/* Open Graph Tags - for social media sharing */}
			<meta property="og:type" content={type} />
			<meta property="og:title" content={fullTitle} />
			<meta property="og:description" content={description} />
			<meta property="og:image" content={image} />
			<meta property="og:url" content={canonicalUrl} />
			<meta property="og:site_name" content={Club.name} />

			{/* Twitter Card Tags */}
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:title" content={fullTitle} />
			<meta name="twitter:description" content={description} />
			<meta name="twitter:image" content={image} />

			{/* Article specific meta tags */}
			{type === "article" && publishedAt && <meta property="article:published_time" content={new Date(publishedAt).toISOString()} />}
			{type === "article" && updatedAt && <meta property="article:modified_time" content={new Date(updatedAt).toISOString()} />}
			{type === "article" && author && <meta property="article:author" content={author} />}

			{/* Additional SEO */}
			<meta name="robots" content="index, follow" />
			<meta name="language" content="de" />
		</Helmet>
	);
}
