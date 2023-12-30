import fs from "fs";
import path from "path";
import { shuffleArray } from "./shuffleArray";

export function fetchFotos(limit?: number) {
	const folderBase = process.cwd();
	const folderRoot = "public";
	const folderActual = "images/blog";
	const folderPrefix = path.join(folderBase, folderRoot);
	const folder = path.join(folderPrefix, folderActual);
	const files = fs.readdirSync(folder, { recursive: true, withFileTypes: true });
	const filesFiltered = files.filter((file) => {
		path.resolve();
		return path.extname(file.name) == ".jpg";
	});
	const filesShuffled = shuffleArray(filesFiltered);
	let imageArray = new Array();
	filesShuffled.map((image) => {
		imageArray.push(path.join(image.path.replace(folderPrefix, ""), image.name));
	});

	if (limit) {
		return imageArray.slice(0, limit);
	} else {
		return imageArray;
	}
}
