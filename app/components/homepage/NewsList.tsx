"use server";
import NewsCard from "@/app/components/ui/NewsCard";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";

// default values
let folder = "data/posts";

export default async function Display(props: {
	limit?: number;
	folder?: string;
	pageStart?: number;
	pageEnd?: number;
}) {
	if (props.folder) {
		folder = props.folder;
	}
	const files = fs.readdirSync(folder);

	const posts = files.map((filename) => {
		// create slug
		const slug = path.parse(filename).name;
		// get frontmatter
		const { data: frontmatter, content } = matter.read(path.join(folder, filename));
		if (!frontmatter.date) {
			frontmatter.date = null;
		}
		return {
			slug,
			frontmatter,
			content,
		};
	});
	// sort posts by date frontmatter
	posts.sort((b, a) => {
		return new Date(a.frontmatter.date).getTime() - new Date(b.frontmatter.date).getTime();
	});
	return (
		<>
			{posts.slice(props.pageStart, props.pageEnd).map((news) => {
				return (
					<NewsCard
						key={news.slug}
						title={news.frontmatter.title}
						slug={news.slug}
						content={news.content}
						{...news.frontmatter} // title, date, thumbnail, gallery (and everything else)
					/>
				);
			})}
		</>
	);
}
