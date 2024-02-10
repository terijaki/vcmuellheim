import fs from "fs";
import path from "path";
import { writeToSummary } from "@/app/utils/github/actionSummary";

const INBOX_FOLDER = "inbox",
	IMAGE_FOLDER = "public/images/blog",
	DOCUMENT_EXTENSIONS = ["docx", "doc"],
	IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"],
	POST_TARGET_FOLDER = "data/posts";

export function inboxProcessing() {
	// check if the inbox directory is even present
	if (fs.existsSync(INBOX_FOLDER)) {
		let message = "🕵️ Inbox folder detected. Processing contents:";
		const files = fs.readdirSync(INBOX_FOLDER);
		files.forEach((file) => {
			message = message + "\n- " + file;
		});

		// identify documents
		const documents = files.filter((element) => {
			const thisExtension = element.split(".").pop() + "";
			if (DOCUMENT_EXTENSIONS.includes(thisExtension.toLowerCase())) {
				return true;
			}
		});

		// identify images, rename & move them and note them down as reference
		let images = new Set<string[]>();
		files.forEach((file) => {
			const thisExtension = file.split(".").pop() + "";
			if (IMAGE_EXTENSIONS.includes(thisExtension.toLowerCase())) {
				const newName = file.toLowerCase().replace(".jpeg", ".jpg");
				const dateSubfolders = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
				const newDirectory = path.join(IMAGE_FOLDER, dateSubfolders);
				const newPath = path.join(newDirectory, newName);
				const oldPath = path.join(INBOX_FOLDER, file);
				images.add([oldPath, newPath]);
			}
		});

		// check conditions | either a single post with images or multiple posts without images are allowed
		if (documents.length > 1 && images.size > 0) {
			throw "🚨 " + images.size + " images and " + documents.length + " document found in the inbox. This utility can only process one document at a time while images are present!";
		} else {
			documents.forEach(async (document) => {
				// isolate the file name as title
				const fileNameLenght = document.lastIndexOf(".");
				const title = document.slice(0, fileNameLenght);
				// read the document
				const WordExtractor = require("word-extractor");
				const extractor = new WordExtractor();
				const extracted = await extractor.extract(path.join(INBOX_FOLDER, document));
				const content = extracted.getBody().replaceAll("\n", "\n\n"); // double linebreaks are required!
				const markdownDate = new Date().toISOString();
				let markdownGallery = "";
				if (images.size > 0) {
					markdownGallery = "gallery:\n";
					images.forEach((image) => {
						markdownGallery = markdownGallery + "- /" + image[1].replace("public/", "") + "\n"; // here the nextJS public folder needs to be omitted
					});
				}
				// patch the markdown together
				const markdownContent = "---\n" + "title: '" + title + "'\n" + "date: " + markdownDate + "\n" + markdownGallery + "---\n" + content;
				// write the markdown file
				const safeTitle = title
					.toLowerCase()
					.replaceAll(" ", "-")
					.replaceAll(".", "")
					.replaceAll("ü", "ue")
					.replaceAll("ö", "oe")
					.replaceAll("ä", "ae")
					.replaceAll("ß", "ss")
					.replaceAll(/[^\x00-\x7F]/g, "");
				const documentTargetPath = POST_TARGET_FOLDER + "/" + new Date().toISOString().slice(0, 10) + "-" + safeTitle + ".md";
				fs.writeFileSync(documentTargetPath, markdownContent);
				images.forEach((image) => {
					const newFolder = image[1].slice(0, image[1].lastIndexOf("/"));
					fs.mkdirSync(newFolder, { recursive: true });
					fs.renameSync(image[0], image[1]); // moves the image from its old location to the new location
				});
				fs.rmSync(path.join(INBOX_FOLDER, document));
				let message = "✅ Processed " + documents.length + " blog post: " + '"' + title + '"';
				if (images.size > 0) {
					message = message.replace("blog post:", "blog post with " + images.size + " images:");
				}
				writeToSummary(message, true);
				console.log(message);
			});
		}
	}
}

inboxProcessing();
