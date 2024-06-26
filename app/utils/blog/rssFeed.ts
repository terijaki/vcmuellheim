import { Feed } from "feed";
import { env } from "process";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

let HOMEPAGE = env.NEXT_PUBLIC_FULL_URL,
	NAME = env.NEXT_PUBLIC_CLUBNAME,
	EMAIL = env.NEXT_PUBLIC_GENERIC_EMAIL;

const POSTS_FOLDER = "data/posts";

type postData = {
	title: string;
	content: string;
	date: string;
	image: string;
	link: string;
	id: string;
};

export default function rssFeed() {
	if (HOMEPAGE && HOMEPAGE.includes("http")) {
		if (HOMEPAGE.slice(0, -1) != "/") {
			HOMEPAGE = HOMEPAGE + "/";
		}

		const feed = new Feed({
			title: "Volleyballclub Müllheim e.V.",
			description: "Neuigkeiten aus dem Verein",
			id: HOMEPAGE,
			link: HOMEPAGE,
			language: "de",
			image: HOMEPAGE + "images/logo/variant2.png",
			favicon: HOMEPAGE + "images/icons/favicon.ico",
			copyright: "Volleyballclub Müllheim e.V. " + new Date().getFullYear(),
			generator: "jpmonette/feed",
			feedLinks: {
				json: HOMEPAGE + "json",
				atom: HOMEPAGE + "atom",
			},
			author: {
				name: NAME,
				email: EMAIL,
			},
		});

		const postFiles = fs.readdirSync(POSTS_FOLDER);

		postFiles.forEach((filename) => {
			const { data: frontmatter, content: content } = matter.read(path.join(POSTS_FOLDER, filename));
			let thumbnail: string = "";
			if (frontmatter.gallery) {
				const shuffledGallery = frontmatter.gallery.sort(() => 0.5 - Math.random());
				thumbnail = HOMEPAGE + shuffledGallery[0];
			}
			if (path.parse(filename).ext == ".md" || path.parse(filename).ext == ".mdx") {
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
					link: HOMEPAGE + slug,
					content: contentFormatted,
					date: new Date(frontmatter.date),
					image: thumbnail,
				});
			} else {
				console.log(filename + " was skipped during RSS feed generation");
			}
		});

		feed.addCategory("Sports");

		feed.addContributor({
			name: NAME,
		});

		// Output: RSS 2.0
		fs.writeFileSync("public/rss.xml", feed.rss2());
		// Output: JSON Feed 1.0
		fs.writeFileSync("public/rss.json", feed.json1());
		// Output: Atom 1.0
		fs.writeFileSync("public/atom.xml", feed.atom1());
	}
}
