/**
 * AWS Lambda handler for generating sitemap.xml
 * Triggered by HTTP GET request to /sitemap.xml
 */

import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import middy from "@middy/core";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { getAllTeams, getPublishedNews, getUpcomingEvents } from "../../lib/db/repositories";

const BASE_URL = process.env.WEBSITE_URL || "https://vcmuellheim.de";

// Initialize Logger and Tracer outside handler for reuse across invocations
const logger = new Logger({
	serviceName: "vcm-sitemap",
	logLevel: (process.env.LOG_LEVEL || "INFO") as "DEBUG" | "INFO" | "WARN" | "ERROR",
});

const tracer = new Tracer({
	serviceName: "vcm-sitemap",
	enabled: process.env.POWERTOOLS_TRACE_ENABLED !== "false",
});

interface UrlEntry {
	loc: string;
	lastmod?: string;
	priority: number;
	changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
}

const lambdaHandler: APIGatewayProxyHandlerV2 = async (event) => {
	logger.appendKeys({
		path: event.rawPath || "unknown",
		method: event.requestContext?.http?.method || "unknown",
	});

	try {
		const urls: UrlEntry[] = [];

		// Static pages with priorities
		const staticPages: UrlEntry[] = [
			{ loc: "", priority: 1.0, changefreq: "weekly" },
			{ loc: "/news", priority: 0.9, changefreq: "weekly" },
			{ loc: "/teams", priority: 0.85, changefreq: "monthly" },
			{ loc: "/termine", priority: 0.85, changefreq: "weekly" },
			{ loc: "/fotos", priority: 0.7, changefreq: "monthly" },
			{ loc: "/impressum", priority: 0.5, changefreq: "yearly" },
			{ loc: "/datenschutz", priority: 0.5, changefreq: "yearly" },
			{ loc: "/satzung", priority: 0.4, changefreq: "yearly" },
			{ loc: "/beitragsordnung", priority: 0.4, changefreq: "yearly" },
			{ loc: "/jugendschutz", priority: 0.4, changefreq: "yearly" },
		];

		urls.push(...staticPages);

		// Fetch dynamic content in parallel
		const [newsList, teamsList, eventsList] = await Promise.all([
			getPublishedNews(1000), // Get all published articles
			getAllTeams(),
			getUpcomingEvents(1000), // Get all upcoming events
		]);

		// Add published news articles
		newsList.items.forEach((article) => {
			urls.push({
				loc: `/news/${article.id}`,
				lastmod: article.updatedAt,
				priority: 0.8,
				changefreq: "never",
			});
		});

		// Add team pages
		teamsList.items.forEach((team) => {
			urls.push({
				loc: `/teams/${team.slug}`,
				lastmod: team.updatedAt,
				priority: 0.75,
				changefreq: "monthly",
			});
		});

		// Add event pages
		eventsList.items.forEach((event) => {
			urls.push({
				loc: `/termine/${event.id}`,
				lastmod: event.updatedAt,
				priority: 0.7,
				changefreq: "never",
			});
		});

		// Generate XML
		const xml = generateSitemapXml(urls);

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=259200", // Cache for 3 days
			},
			body: xml,
		};
	} catch (error) {
		logger.error("Sitemap generation failed", {
			error: { message: error instanceof Error ? error.message : String(error) },
		});

		// Return a minimal valid sitemap on error
		const fallbackXml = generateSitemapXml([
			{ loc: "", priority: 1.0, changefreq: "weekly" },
			{ loc: "/news", priority: 0.9, changefreq: "daily" },
			{ loc: "/teams", priority: 0.85, changefreq: "weekly" },
		]);

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
				"Cache-Control": "public, max-age=3600", // Cache for 1 hour on error
			},
			body: fallbackXml,
		};
	} finally {
		logger.resetKeys();
	}
};

export const handler = middy(lambdaHandler)
	.use(captureLambdaHandler(tracer, { captureResponse: false }))
	.use(injectLambdaContext(logger));

/**
 * Generate sitemap XML from URL entries
 */
function generateSitemapXml(urls: UrlEntry[]): string {
	const urlEntries = urls
		.map((url) => {
			const fullUrl = `${BASE_URL}${url.loc}`;
			let entry = `  <url>\n`;
			entry += `    <loc>${escapeXml(fullUrl)}</loc>\n`;
			if (url.lastmod) {
				entry += `    <lastmod>${url.lastmod}</lastmod>\n`;
			}
			entry += `    <changefreq>${url.changefreq}</changefreq>\n`;
			entry += `    <priority>${url.priority}</priority>\n`;
			entry += `  </url>\n`;
			return entry;
		})
		.join("");

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}</urlset>`;
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
	return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
