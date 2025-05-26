import config from "@/payload.config";
import { createHeadlessEditor } from "@lexical/headless";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import dayjs from "dayjs";
import matter from "gray-matter";
import { type NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getPayload } from "payload";

export async function POST(request: NextRequest) {
	try {
		// Check for authorization header
		const authHeader = request.headers.get("authorization");
		const expectedSecret = process.env.PAYLOAD_SECRET;

		if (!expectedSecret) {
			return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
		}

		if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const payload = await getPayload({ config });

		const postsDirectory = path.join(process.cwd(), "data", "posts");

		// Check if directory exists
		if (!fs.existsSync(postsDirectory)) {
			return NextResponse.json({ error: "Posts directory not found" }, { status: 404 });
		}

		const files = fs.readdirSync(postsDirectory).filter((file) => file.endsWith(".md"));

		let processed = 0;
		let created = 0;
		let skipped = 0;
		let errored = 0;
		const errors: string[] = [];

		for (const file of files) {
			processed++;
			try {
				const filePath = path.join(postsDirectory, file);
				const fileContent = fs.readFileSync(filePath, "utf8");
				const { data, content } = matter(fileContent);

				const title: string = data.title || path.basename(file, ".md");
				const publishedDate: string = dayjs(data.date).isValid()
					? dayjs(data.date).toISOString()
					: dayjs().toISOString();

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

				// Handle empty content case
				if (!content || content.trim().length === 0) {
					skipped++;
					continue;
				}

				// Convert markdown to Lexical rich text format
				const editor = createHeadlessEditor();

				// biome-ignore lint/suspicious/noExplicitAny: Lexical content structure
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
				errored++;
				errors.push(`Error processing ${file}: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}

		return NextResponse.json({
			success: true,
			message: "Migration completed",
			stats: {
				processed,
				created,
				skipped,
				errored,
			},
			errors: errors.length > 0 ? errors : undefined,
		});
	} catch (error) {
		console.error("Migration failed:", error);
		return NextResponse.json(
			{
				error: "Migration failed",
				message: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}
