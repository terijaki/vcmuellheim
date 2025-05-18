import { Club } from "@/project.config";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";
import { writeToSummary } from "../github/actionSummary";
import { mastodonPostStatus, mastodonSearchStatus } from "../social/mastodon";

const POST_PATH = "data/posts";
const TIME_TOLERANCE = 7; // exclude any older posts than this value (in days)

export type shareStatus = "new" | "queued" | "published" | "legacy";
export type postFrontmatter = {
	content: string;
	data: {
		title?: string;
		date?: string;
		gallery?: string[];
		mastodon?: shareStatus;
		mastodonUrl?: string;
	};
	path?: string;
};

export async function shareNewPosts() {
	// check if there is even a blog directory
	if (!fs.existsSync(POST_PATH)) {
		throw "🚨 Cannot find posts. Path does not exists!";
	}
	// fetch all blog posts
	const files = fs.readdirSync(POST_PATH);
	// create a Set of relevant posts. e.g. exclude all posts who have already been shared or are too old
	const newPosts = new Set<postFrontmatter>();
	for (const file of files) {
		const content: postFrontmatter = matter.read(path.join(POST_PATH, file));
		const today = new Date();
		today.setDate(today.getDate() - 3);
		if (content.data.mastodon !== "published" && content.data.date && new Date(content.data.date) > today) {
			if (content.data.title && content.path && content.data.date) {
				newPosts.add(content);
			}
		}
	}
	// console.log(newPosts);

	for (const content of Array.from(newPosts)) {
		if (!content.path) {
			throw "🚨 Object does not contain path! Therefore cannot modify the post's file.";
		}
		// set status to queued before attempting to share
		content.data.mastodon = "queued";
		const contentAsString = matter.stringify(content, {}); // transform it back to a string so that it can be writen back to the file
		fs.writeFileSync(content.path, contentAsString); // update the post file

		// construct the URL to be shared
		let postUrl = content.path.replace(POST_PATH, ""); // remove the path
		postUrl = postUrl.slice(0, postUrl.lastIndexOf(".")); // remove the file extension
		postUrl = `https://${Club.domain}${postUrl}`;
		const message: string = `${content.data.title} ${postUrl}`;

		// check if the post has already been shared to avoid duplicates
		const checkStatusExistance = await mastodonSearchStatus(postUrl);
		if (checkStatusExistance.status !== 200) {
			throw `Could not verify status existence:${checkStatusExistance.status}`;
		}

		for (const response of checkStatusExistance.response) {
			// do not post duplicate if a status is found
			if (response.created_at) {
				const consoleNote = `🚨 Message has already been shared on ${new Date(response.created_at).toLocaleString("en-GB", { dateStyle: "short" })} (${response.url}). Marking post as published.`;
				console.log(consoleNote);
				writeToSummary(consoleNote);
				// set frontmatter to published
				content.data.mastodon = "published";
				content.data.mastodonUrl = response.url;
			}
		}

		if (!content.data.mastodonUrl) {
			console.log(`🕵️ attempting to share to Mastodon: "${message}"`);
			// share the message as Mastodon status
			const postStatus = await mastodonPostStatus(message); // this will post the message

			if (postStatus.status === 200) {
				const consoleNote = `✅ Post shared successfully: ${postStatus.response.url}`;
				console.log(consoleNote);
				writeToSummary(consoleNote);
				// set frontmatter to published
				content.data.mastodon = "published";
				content.data.mastodonUrl = postStatus.response.url;
			} else {
				const consoleNote = `🚨 Post (${content.data.title}) could not be shared! ${postStatus.status}`;
				console.log(consoleNote);
				writeToSummary(consoleNote);
				throw consoleNote;
			}
		}

		const updatedContentAsString = matter.stringify(content, {}); // transform the content Object to a string so that it can be writen back to the file
		fs.writeFileSync(content.path, updatedContentAsString); // update the post file
	}
	return true;
}

shareNewPosts();
