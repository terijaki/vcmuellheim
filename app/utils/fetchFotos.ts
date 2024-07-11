import fs from "fs";
import path from "path";
import { shuffleArray } from "./shuffleArray";

export async function fetchFotos(limit?: number): Promise<string[]> {
	try {
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
		let imageArray = new Array<string>();
		filesShuffled.map((image) => {
			imageArray.push(path.join(image.path.replace(folderPrefix, ""), image.name));
		});

		if (limit) {
			return imageArray.slice(0, limit);
		} else {
			return imageArray;
		}
	} catch (error) {
		console.log(error);
		return []; // return empty array
	}
}
