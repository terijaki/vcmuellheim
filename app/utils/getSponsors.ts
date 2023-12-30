import path from "path";
import fs from "fs";
import matter from "gray-matter";

const SPONSOR_DURATION: number = 12; // in months
const SPONSORS_FOLDER: string = "data/sponsors";
const TODAY: number = new Date().getTime();

export function getActiveSponsors() {
	const targetFolder = SPONSORS_FOLDER;
	const sponsorsFiles = fs.readdirSync(targetFolder);
	const sponsorsMatter = sponsorsFiles.map((sponsor) => {
		const { data: frontmatter } = matter.read(path.join(targetFolder, sponsor));
		// 🐛 BUG 🐛 THIS frontmatter.date IS ALREADY OFF BY 3 YEARS

		return frontmatter;
	});
	// filter out sponsors whos date is outside the SPONSOR_DURATION
	const sponsorsFiltered = sponsorsMatter.filter((sponsor) => {
		let sponsorCutOffDate = new Date(sponsor.date.setMonth(new Date(sponsor.date).getMonth() + SPONSOR_DURATION));
		if (Number(sponsorCutOffDate) > TODAY) {
			return sponsor;
		}
	});
	// randomize the order of sponsors
	const sponsorsSorted = sponsorsFiltered.sort(() => 0.5 - Math.random());

	// console.log(sponsorsSorted);
	return sponsorsSorted;
}
