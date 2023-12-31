import path from "path";
import fs from "fs";
import matter from "gray-matter";
import { shuffleArray } from "./shuffleArray";

const SPONSOR_DURATION: number = 13; // in months
const SPONSORS_FOLDER: string = "data/sponsors";
const TODAY: Date = new Date();

export function getActiveSponsors() {
	const targetFolder = SPONSORS_FOLDER;
	const sponsorsFiles = fs.readdirSync(targetFolder);
	const sponsorsMatter = sponsorsFiles.map((sponsor) => {
		const { data: frontmatter } = matter.read(path.join(targetFolder, sponsor));
		// 🐛 BUG 🐛 THIS frontmatter.date IS ALREADY OFF BY 3 YEARS
		// console.log(frontmatter.date);

		return frontmatter;
	});
	// filter out sponsors whos date is outside the SPONSOR_DURATION
	const sponsorsFiltered = sponsorsMatter.filter((sponsor) => {
		let sponsorCutOffDate = new Date(sponsor.date);
		sponsorCutOffDate.setMonth(sponsorCutOffDate.getMonth() + SPONSOR_DURATION);

		console.log(sponsor.name + " from: " + sponsor.date.toLocaleDateString("de-DE") + " until: " + sponsorCutOffDate.toLocaleDateString("de-DE"));

		if (sponsorCutOffDate > TODAY) {
			return sponsor;
		}
	});
	// randomize the order of sponsors
	const sponsorsRandomised = shuffleArray(sponsorsFiltered);

	// console.log(sponsorsRandomised);
	return sponsorsRandomised;
}
