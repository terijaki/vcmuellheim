import fs from "fs";
import matter from "gray-matter";
import path from "path";
import { teamObject } from "./getTeams";

export function moveFolder(sourceFolder: string, targetFolder: string, forced = false) {
	if (fs.existsSync(sourceFolder)) {
		console.log("🤔 The '" + sourceFolder + "' folder exists! Attempting to move it to '" + targetFolder + "'...");

		if (!fs.existsSync(targetFolder)) {
			fs.mkdirSync(targetFolder, { recursive: true });
		} else if (forced == true) {
			fs.rmSync(targetFolder, { recursive: true });
			fs.mkdirSync(targetFolder);
		}
		const oldFiles = fs.readdirSync(sourceFolder, { recursive: true, withFileTypes: true });
		let errorMessage: any[] = []; // placeholder to check against at the end
		oldFiles.map((file) => {
			// console.log(file);
			// console.log(file.isFile());

			if (file.isFile() && file.name != ".DS_Store") {
				const fileOld = path.join(file.path, file.name);
				const folderNew = path.join(targetFolder, file.path.replace(sourceFolder, ""));
				const fileNew = path.join(folderNew, file.name);
				try {
					// try to copy the old file to the new file location
					fs.mkdirSync(folderNew, { recursive: true });
					fs.copyFileSync(fileOld, fileNew, fs.constants.COPYFILE_EXCL);
				} catch (error) {
					errorMessage.push(error); // this is output if new and old files are not identical (because otherwise it doesn't matter)
				}
				if (fs.readFileSync(fileNew).compare(fs.readFileSync(fileOld)) == 0) {
					// when the new and old files are identical, its safe to delete the old file
					fs.rmSync(fileOld, { recursive: true });
					// console.log("✅ moved: " + file.path + file.name);
				} else {
					console.log("😨 " + errorMessage[0]);
				}
			}
		});
		// check if all good and the old folder can be deleted
		if (errorMessage.length > 0) {
			console.log("🚨 " + errorMessage.length + " error(s) could not be resolved! Please check the logs above.");
		} else {
			console.log("🌈 Folder move from:'" + sourceFolder + "' to:'" + targetFolder + "' successfull!");
			fs.rmdirSync(sourceFolder, { recursive: true });
		}
	}
}
export function deleteFolder(targetFolder: string) {
	if (fs.existsSync(targetFolder)) {
		fs.rmdirSync(targetFolder, { recursive: true });
	}
}
export function deleteFile(targetFile: string) {
	if (fs.existsSync(targetFile)) {
		fs.rmSync(targetFile, { recursive: true });
	}
}

export function migratePosts() {
	const POSTS_FOLDER_OLD = "_posts";
	const POSTS_FOLDER_NEW = "data/posts";
	if (fs.existsSync(POSTS_FOLDER_OLD)) {
		console.log("🤔 '" + POSTS_FOLDER_OLD + "' folder exists! Attempting to move files to '" + POSTS_FOLDER_NEW + "'...");
		if (!fs.existsSync(POSTS_FOLDER_NEW)) {
			fs.mkdirSync(POSTS_FOLDER_NEW);
			// create the new folder if it does not exists
		}
		const targetFolder = POSTS_FOLDER_OLD;
		const targetFiles = fs.readdirSync(targetFolder);

		// 📆 STEP "DATE"📆: Add date frontmatter
		targetFiles.map((file) => {
			const filePath = path.join(targetFolder, file);
			const fileContent = fs.readFileSync(filePath).toString();
			const fileMatter = matter.read(path.join(targetFolder, file));
			if (!fileMatter.data.date) {
				console.log(file + " has no date frontmatter. Fixing..");
				const fileDate = file.slice(0, 10); // date in file name, e.g. 2019.02.06
				const fileFistHalf = fileContent.slice(0, 3); // 0-3 because thats the 3 frontmatter dashes
				const fileSecondHalf = fileContent.slice(3);
				const fileNewContent = fileFistHalf + "\ndate: " + fileDate + fileSecondHalf;
				try {
					fs.writeFileSync(filePath, fileNewContent);
				} catch (e) {
					console.log("🚨 date could not be patched:" + file);
				}
			}
		});
		// 🧽 STEP "JEKYLL DATA" 🧽: Remove the "layout:post" and "exceprt separator" Jekyll specific frontmatter. Then rename the file to be all lowercase
		targetFiles.map((file) => {
			const filePath = path.join(targetFolder, file);
			const trimmedFile = fs.readFileSync(filePath).toString();
			const trimmed = trimmedFile
				.replace("layout: post\n", "")
				.replace('excerpt_separator: "<!-- more -->"\n', "")
				.replace('excerpt_separator: "<!--more-->"\n', "")
				.replace("excerpt_separator: <!--more-->\n", "");
			fs.writeFileSync(filePath, trimmed);
			// !!! the following code removes the date prefix in the name, though this is needed to avoid aving duplicate file names. e.g. "stadtfest.md" every year
			// const filenameDatePrefix = file.slice(0, 11);
			// if (filenameDatePrefix.match("[0-9]{4}-[0-9]{2}-[0-9]{2}")) {
			// 	console.log("Removing data prefix in file: " + file);
			// 	fs.renameSync(filePath, path.join(targetFolder, file.slice(11)).toLowerCase());
			// }
		});

		// 🏞️ STEP "IMAGES" 🏞️: Move imgaes out of the post and into the gallery
		const REGEX_FOR_IMAGES: RegExp = /\!\[\]\(.*?\)/gm; // regex for the image markdown
		targetFiles.map((file) => {
			const fileContent = fs.readFileSync(path.join(targetFolder, file)).toString();
			const fileHasImage = fileContent.match(REGEX_FOR_IMAGES);
			// if the file contains an image markdown ...
			if (fileHasImage) {
				console.log("🏞️ " + file + " had images inside the post. Converted them to gallery items.");
				let fileNewPlaceholder = fileContent;
				let galleryItems: string[] = [];
				fileHasImage.map((match) => {
					// remove the markdown images from the placeholder
					fileNewPlaceholder = fileNewPlaceholder.replace(match, "");
					galleryItems.push(match.replace("!", "- ").replace("(", "").replace(")", "").replace("[", "").replace("]", ""));
				});
				// write updates to the file
				let galleryFrontmatter;
				if (fileNewPlaceholder.indexOf("gallery:") == -1) {
					galleryFrontmatter = "gallery:\n";
				}
				const target = fileNewPlaceholder.lastIndexOf("---");
				const slice1 = fileNewPlaceholder.slice(0, target);
				const slice2 = "\n" + fileNewPlaceholder.slice(target);
				const galleryItemsFlat = galleryItems.flat(Infinity).toString().replaceAll(",", "\n");
				const newFileContent = slice1 + galleryFrontmatter + galleryItemsFlat + slice2;
				fs.writeFileSync(path.join(targetFolder, file), newFileContent);
			}
		});

		// 🚚 STEP "MOVE" 🚚: This steps tries to move the post files over. If no roadblock occured, then the old post folder is deleted.
		let errorMessage: any[] = []; // placeholder to check against at the end
		targetFiles.map((file) => {
			const fileOld = path.join(POSTS_FOLDER_OLD, file);
			const fileNew = path.join(POSTS_FOLDER_NEW, file);
			try {
				// try to copy the old file to the new file location
				fs.copyFileSync(fileOld, fileNew, fs.constants.COPYFILE_EXCL);
			} catch (error) {
				errorMessage.push(error); // this is output if new and old files are not identical (because otherwise it doesn't matter)
			}
			if (fs.readFileSync(fileNew).compare(fs.readFileSync(fileOld)) == 0) {
				// when the new and old files are identical, its safe to delete the old file
				fs.rmSync(fileOld, { recursive: true });
				console.log("✅ moved: " + file);
			} else {
				console.log("😨 " + errorMessage[0]);
			}
		});
		// check if all good and the old folder can be deleted
		if (errorMessage.length > 0) {
			console.log("🚨 " + errorMessage.length + " error(s) could not be resolved! Please check the logs above.");
		} else {
			console.log("🌈 migration successfull!");
			fs.rmdirSync(POSTS_FOLDER_OLD);
		}
	}
}

export function replaceString(targetFolder: string, oldString: string, newString: string) {
	// check if the folder exists
	if (fs.existsSync(targetFolder)) {
		console.log("🤔 Replacing '" + oldString + "' with '" + newString + "' for all files in '" + targetFolder + "'");
		// get a file list
		const files = fs.readdirSync(targetFolder);
		files.map((file) => {
			// for each file in the list, read the content, replace the string, write it back to the file
			const filePath = path.join(targetFolder, file);
			const fileContent = fs.readFileSync(filePath).toString();
			const fileNewString = fileContent.replaceAll(oldString, newString);
			fs.writeFileSync(filePath, fileNewString);
		});
	}
}

export function migrateTeamsToJSON() {
	const sourceFolder = "_teams";
	const targetFolder = "data/teams";

	if (fs.existsSync(sourceFolder)) {
		const teamFiles = fs.readdirSync(sourceFolder);

		teamFiles.map((team) => {
			const { data: teamMatter } = matter.read(path.join(sourceFolder, team));
			let teamData: teamObject = new Object();
			teamData.title = teamMatter.title ? teamMatter.title : undefined;
			teamData.sorting = teamMatter.sorting ? teamMatter.sorting : 999;
			teamData.liga = teamMatter.liga ? teamMatter.liga : undefined;
			teamData.sbvvId = teamMatter.sbvv_id ? teamMatter.sbvv_id : undefined;
			teamData.alter = teamMatter.alter ? teamMatter.alter : undefined;

			if (teamMatter["trainings-zeit1"] || teamMatter["trainings-zeit2"]) {
				teamData.training = [{}];
				if (teamMatter["trainings-zeit1"]) {
					let trainingObject = { zeit: teamMatter["trainings-zeit1"], ort: teamMatter["trainings-ort1"], map: teamMatter["trainings-map1"] };
					teamData.training.push(trainingObject);
				}
				if (teamMatter["trainings-zeit2"]) {
					let trainingObject = { zeit: teamMatter["trainings-zeit2"], ort: teamMatter["trainings-ort2"], map: teamMatter["trainings-map2"] };
					teamData.training.push(trainingObject);
				}
				teamData.training.shift();
			} else {
				teamData.training = undefined;
			}

			if (teamMatter["trainer-name1"] || teamMatter["trainer-name2"]) {
				teamData.trainer = [{}];
				if (teamMatter["trainer-name1"]) {
					let trainerObject = { name: teamMatter["trainer-name1"], email: teamMatter["trainer-email1"] };
					teamData.trainer.push(trainerObject);
				}
				if (teamMatter["trainer-name2"]) {
					let trainerObject = { name: teamMatter["trainer-name2"], email: teamMatter["trainer-email2"] };
					teamData.trainer.push(trainerObject);
				}
				teamData.trainer.shift();
			} else {
				teamData.trainer = undefined;
			}
			if (teamMatter["ansprechperson-name1"] || teamMatter["ansprechperson-name2"]) {
				teamData.ansprechperson = [{}];
				if (teamMatter["ansprechperson-name1"]) {
					let ansprechpersonObject = { name: teamMatter["ansprechperson-name1"], email: teamMatter["ansprechperson-email1"] };
					teamData.ansprechperson.push(ansprechpersonObject);
				}
				if (teamMatter["ansprechperson-name2"]) {
					let ansprechpersonObject = { name: teamMatter["ansprechperson-name2"], email: teamMatter["ansprechperson-email2"] };
					teamData.ansprechperson.push(ansprechpersonObject);
				}
				teamData.ansprechperson.shift();
			} else {
				teamData.ansprechperson = undefined;
			}
			teamData.kommentar = teamMatter.kommentar ? teamMatter.kommentar : undefined;
			teamData.kurztext = teamMatter.kurztext ? teamMatter.kurztext : undefined;
			teamData.foto = teamMatter.foto ? teamMatter.foto : undefined;

			// console.log(teamData);
			fs.mkdirSync(targetFolder, { recursive: true });
			let newFile = team.replace(".md", ".json").replace("-", "_");
			fs.writeFileSync(path.join(targetFolder, newFile), JSON.stringify(teamData, null, 2));
			fs.rmdirSync(sourceFolder, { recursive: true });
		});
	}
}
