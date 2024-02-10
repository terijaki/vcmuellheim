import fs from "fs";
import matter from "gray-matter";
import path from "path";

const POST_PATH = "data/posts",
	TIME_TOLERANCE = 7; // exclude any older posts than this value (in days)

export type shareStatus = "new" | "queued" | "published" | "legacy";
export type postFrontmatter = {
	content: string;
	data: {
		title?: string;
		date?: string;
		gallery?: string[];
		mastodon?: shareStatus;
	};
	path?: string;
};

export function shareNewPosts() {
	// check if there is even a blog directory
	if (!fs.existsSync(POST_PATH)) {
		throw "🚨 Cannot find posts. Path does not exists!";
	} else {
		// fetch all blog posts
		const files = fs.readdirSync(POST_PATH);
		// create a Set of relevant posts. e.g. exclude all posts who have already been shared or are too old
		let newPosts = new Set<postFrontmatter>();
		files.forEach((file) => {
			const content: postFrontmatter = matter.read(path.join(POST_PATH, file));
			const today = new Date();
			today.setDate(today.getDate() - 3);
			if (content.data.mastodon != "published" && content.data.date && new Date(content.data.date) > today) {
				if (content.data.title && content.path && content.data.date) {
					newPosts.add(content);
				}
			}
		});
		console.log(newPosts);

		newPosts.forEach((content) => {
			content.data.mastodon = "queued";
			console.log(matter.stringify(content));
			// https://www.npmjs.com/package/gray-matter
			// console.log(matter.stringify('foo bar baz', {title: 'Home'}));
			// attempt to share and write queued status
			// share
			// write published status
			// mastodon: new | queued | published
		});
	}
	// forEach:
	// read frontmatter
	// filter by Date
	// filter by not-yet-shared
	// share
	// write published status
	// mastodon: new | queued | published

	return true;
}

shareNewPosts();
// npm run blog-new-posts
