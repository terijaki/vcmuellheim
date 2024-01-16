import fs from "fs";
import path from "path";
import { writeToSummary } from "./github/actionSummary";

const INBOX_FOLDER = "inbox",
	IMAGE_FOLDER = "images/blog",
	DOCUMENT_EXTENSIONS = ["docx", "rtf", "txt", "odt"],
	IMAGE_EXTENSIONS = ["jpg", "jpeg", "png"];

export function inboxProcessing() {
	// check if the inbox directory is even present
	if (fs.existsSync(INBOX_FOLDER)) {
		let message = "🕵️ Inbox folder detected. Processing contents:";
		const files = fs.readdirSync(INBOX_FOLDER);
		files.forEach((file) => {
			message = message + "\n- " + file;
		});
		// console.log(message);
		// writeToSummary(message);

		// identify documents
		const documents = files.filter((element) => {
			const thisExtension = element.split(".").pop() + "";
			if (DOCUMENT_EXTENSIONS.includes(thisExtension.toLowerCase())) {
				return true;
			}
		});
		console.log("Number of documents found: " + documents.length);

		// identify images, rename & move them and note them down as reference
		let images = new Set();
		files.forEach((file) => {
			const thisExtension = file.split(".").pop() + "";
			if (IMAGE_EXTENSIONS.includes(thisExtension.toLowerCase())) {
				const newName = file.toLowerCase().replace(".jpeg", ".jpg");
				const dateSubfolders = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
				const newDirectory = path.join(IMAGE_FOLDER, new Date().toISOString().slice(0, 10).replaceAll("-", "/"));
				const newPath = path.join(newDirectory, newName);
				console.log(newPath);
				// fs.renameSync(path.join(INBOX_FOLDER, file), newPath); TODO uncomment this to actually remove the image
				images.add(newPath);
			}
		});

		// NEXT:
		// extract the text
		// create frontmatter
		// create gallery
		// construct file name (prefix is new Date().toISOString().slice(0, 10))
		// write to .md file at the target destination
	}
	// npx tsx app/utils/inboxProcessing.ts
}

inboxProcessing();
