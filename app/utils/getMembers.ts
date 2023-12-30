import fs from "fs";
import matter from "gray-matter";
import path from "path";

const MEMBERS_FOLDER = "data/members";

export type memberObject = {
	name?: string;
	email?: string;
	avatar?: string;
	function?: string;
	sortorder?: number;
};

export function getMembers(memberType: "board" | "trainers", random?: false | true): memberObject[] {
	const targetFolder = path.join(MEMBERS_FOLDER, memberType);
	const membersFiles = fs.readdirSync(targetFolder);
	const membersMatter = membersFiles.map((member) => {
		const { data: frontmatter } = matter.read(path.join(targetFolder, member));
		return frontmatter;
	});
	let membersSorted = membersMatter;
	if (!random) {
		membersSorted = membersMatter.sort((a, b) => {
			if (!a.sortorder) {
				a.sortorder = "9999";
			}
			if (!b.sortorder) {
				b.sortorder = "9999";
			}
			return a.sortorder - b.sortorder;
		});
	} else {
		membersSorted = membersMatter.sort(() => 0.5 - Math.random());
	}
	return membersSorted;
}
