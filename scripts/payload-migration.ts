// this script is used to migrate to payload
// previously data were stored as json or markdown files inside /data
// News were stored as markdown files inside /data/posts
// Teams were stored as json files inside /data/teams

import config from "@/payload.config";
import { createHeadlessEditor } from "@lexical/headless";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import dayjs from "dayjs";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";
import { getPayload } from "payload";

async function migrateNews() {
	const payload = await getPayload({ config });

	const postsDirectory = path.join(process.cwd(), "data", "posts");
	const files = fs.readdirSync(postsDirectory).filter((file) => file.endsWith(".md"));

	let processed = 0;
	let created = 0;
	let skipped = 0;
	let errored = 0;

	for (const file of files) {
		processed++;
		const filePath = path.join(postsDirectory, file);
		const fileContent = fs.readFileSync(filePath, "utf8");
		const { data, content } = matter(fileContent);

		const title: string = data.title || path.basename(file, ".md");
		const publishedDate: string = dayjs(data.date).isValid() ? dayjs(data.date).toISOString() : dayjs().toISOString();

		// Check if news with this title already exists
		const existing = await payload.find({
			collection: "news",
			where: { title: { equals: title } },
			limit: 1,
		});

		if (existing.docs.length > 0) {
			skipped++;
			continue;
		}

		try {
			// Handle empty content case
			if (!content || content.trim().length === 0) {
				console.log(`Skipping ${file}: empty content`);
				skipped++;
				continue;
			}

			// Convert markdown to Lexical rich text format
			const editor = createHeadlessEditor();

			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			let lexicalContent: any = null;

			editor.update(() => {
				$convertFromMarkdownString(content, TRANSFORMERS);
			});

			editor.read(() => {
				const editorState = editor.getEditorState();
				lexicalContent = editorState.toJSON();
			});

			// Validate that we have proper content structure
			if (!lexicalContent || !lexicalContent.root || !Array.isArray(lexicalContent.root.children)) {
				console.error(`Invalid Lexical content structure for ${file}:`, JSON.stringify(lexicalContent, null, 2));
				throw new Error("Failed to convert markdown to valid Lexical content");
			}

			// Ensure we have at least some content
			if (lexicalContent.root.children.length === 0) {
				// Create a basic paragraph with the raw content as fallback
				lexicalContent = {
					root: {
						type: "root",
						children: [
							{
								type: "paragraph",
								children: [
									{
										type: "text",
										text: content.substring(0, 1000), // Limit to prevent issues
										version: 1,
									},
								],
								version: 1,
							},
						],
						direction: "ltr",
						format: "",
						indent: 0,
						version: 1,
					},
				};
			}

			console.log(`Processing ${file}:`, {
				title,
				contentLength: content.length,
				lexicalChildren: lexicalContent.root.children.length,
			});

			await payload.create({
				collection: "news",
				data: {
					title,
					content: lexicalContent,
					publishedDate,
					isPublished: true,
					authors: [],
				},
			});

			created++;
		} catch (error) {
			console.error(`Error processing file ${file}:`, error);
			// Log the content that failed for debugging
			console.error(`Failed content preview: ${content.substring(0, 200)}...`);
			errored++;
		}
	}

	console.log(
		`Migration complete. Processed: ${processed}, Error: ${errored}, Created: ${created}, Skipped: ${skipped}`,
	);

	process.exit(0);
}

migrateNews();
