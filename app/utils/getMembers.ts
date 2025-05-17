import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";
import { shuffleArray } from "./shuffleArray";

const MEMBERS_FOLDER = "data/members";

export type memberObject = {
	name?: string;
	email?: string;
	avatar?: string;
	function?: string;
	sortorder?: number;
	memberType?: string;
};

export function getMembers(memberType?: "board" | "trainers", random?: false | true): memberObject[] {
	// get the directories
	const folders = fs.readdirSync(MEMBERS_FOLDER, { withFileTypes: true }).filter((dirent) => dirent.isDirectory());
	let membersMatter: memberObject[] = [];
	// read directories to get the files
	folders.map((folder) => {
		const files = fs.readdirSync(path.join(folder.path, folder.name));
		// turn every file into an Object & add it to the membersMatter array
		for (const file of files) {
			const { data: frontmatter } = matter.read(path.join(folder.path, folder.name, file));
			if (!frontmatter.sortorder) {
				frontmatter.sortorder = 9999;
			}
			frontmatter.memberType = folder.name;
			membersMatter.push(frontmatter);
		}
	});

	// filter if there is a memberType specified
	if (memberType) {
		membersMatter = membersMatter.filter((member) => member.memberType === memberType);
	}

	// sort members if random is set to false
	let membersSorted = membersMatter;
	if (!random) {
		membersSorted = membersMatter.sort((a, b) => {
			if (!a.sortorder) {
				a.sortorder = 9999;
			}
			if (!b.sortorder) {
				b.sortorder = 9999;
			}
			return a.sortorder - b.sortorder;
		});
	} else {
		membersSorted = shuffleArray(membersMatter);
	}
	return membersSorted;
}
