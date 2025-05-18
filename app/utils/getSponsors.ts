"use server";
import matter from "gray-matter";
import fs from "node:fs";
import path from "node:path";
import { shuffleArray } from "./shuffleArray";

const SPONSOR_DURATION: number = 12; // in months
const SPONSORS_FOLDER: string = "data/sponsors";
const TODAY: Date = new Date();

export async function getActiveSponsors() {
	const targetFolder = SPONSORS_FOLDER;
	const sponsorsFiles = fs.readdirSync(targetFolder);
	const sponsorsMatter = sponsorsFiles.map((sponsor) => {
		const { data: frontmatter } = matter.read(path.join(targetFolder, sponsor));
		return frontmatter;
	});
	// filter out sponsors whos date is outside the SPONSOR_DURATION
	const sponsorsFiltered = sponsorsMatter.filter((sponsor) => {
		const sponsorCutOffDate = new Date(sponsor.date);
		sponsorCutOffDate.setMonth(sponsorCutOffDate.getMonth() + SPONSOR_DURATION);
		if (sponsorCutOffDate > TODAY) {
			return sponsor;
		}
	});
	// randomize the order of sponsors
	const sponsorsRandomised = shuffleArray(sponsorsFiltered);
	// console.log(sponsorsRandomised);
	return sponsorsRandomised;
}
