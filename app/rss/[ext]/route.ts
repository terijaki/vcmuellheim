import { Club } from "@/project.config";
import { Feed } from "feed";
import matter from "gray-matter";
import { type NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

const POSTS_FOLDER = "data/posts";

export async function GET(request: NextRequest, { params }: { params: Promise<{ ext: "json" | "xml" | "atom" }> }) {
	try {
		// Get base URL from the request
		const origin = request.headers.get("host") || "localhost";
		const protocol = request.headers.get("x-forwarded-proto") || "https";
		const baseUrl = `${protocol}://${origin}`;

		const feed = new Feed({
			title: Club.name,
			description: "Neuigkeiten aus dem Verein",
			id: baseUrl,
			link: baseUrl,
			language: "de",
			image: `${baseUrl}/images/logo/variant2.png`,
			favicon: `${baseUrl}/images/icons/favicon.ico`,
			copyright: `Volleyballclub Müllheim e.V. ${new Date().getFullYear()}`,
			generator: "jpmonette/feed",
			feedLinks: {
				json: `${baseUrl}/rss.json`,
				atom: `${baseUrl}/atom`,
			},
			author: {
				name: Club.shortName,
				email: Club.email,
			},
		});
		const postFiles = fs.readdirSync(POSTS_FOLDER);

		for (const filename of postFiles) {
			const { data: frontmatter, content } = matter.read(path.join(POSTS_FOLDER, filename));
			let thumbnail = "";
			if (frontmatter.gallery) {
				const shuffledGallery = frontmatter.gallery.sort(() => 0.5 - Math.random());
				thumbnail = baseUrl + shuffledGallery[0];
			}
			if (path.parse(filename).ext === ".md" || path.parse(filename).ext === ".mdx") {
				const slug = path.parse(filename).name;
				// transform the Markdown to HTML
				const showdown = require("showdown");
				showdown.setFlavor("github");
				const converter = new showdown.Converter();
				const contentFormatted = converter.makeHtml(content);
				// add every blog post as feed item
				feed.addItem({
					title: frontmatter.title,
					id: slug,
					link: `${baseUrl}/${slug}`,
					content: contentFormatted,
					date: new Date(frontmatter.date),
					image: thumbnail,
				});
			} else {
				console.log(`${filename} was skipped during RSS feed generation`);
			}
		}

		feed.addCategory("Sports");

		feed.addContributor({
			name: Club.shortName,
			email: Club.email,
		});

		// Determine the format to return based on the params
		const { ext } = await params;

		if (ext === "json") {
			// Return JSON feed
			return new NextResponse(feed.json1(), {
				headers: {
					"Content-Type": "application/json",
				},
			});
		}
		if (ext === "atom") {
			// Return Atom feed
			return new NextResponse(feed.atom1(), {
				headers: {
					"Content-Type": "application/atom+xml",
				},
			});
		}

		// Default to RSS XML
		return new NextResponse(feed.rss2(), {
			headers: {
				"Content-Type": "application/xml",
			},
		});
	} catch (error) {
		console.error("Error generating RSS feed:", error);
		return new NextResponse("Error generating RSS feed", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
			},
		});
	}
}
