import fs from "fs";
import path from "path";
import { slugify } from "../slugify";
import getClubData from "./getClubData";

const CLUBS_FILE_TARGET = "data/sams/allClubs.json";
const CLUBS_CACHE_FOLDER = "data/sams/clubs";

// get the club's logo url
export async function getClubLogoUrl(clubName: string): Promise<string | undefined> {
	const clubSlug = slugify(clubName);
	const cacheFile = path.join(CLUBS_CACHE_FOLDER, clubSlug + ".json");
	if (!fs.existsSync(cacheFile)) {
		console.log("🕵️ " + clubName + " cache does not exist.");
		// get the club's ID
		const clubId = await getClubId(clubName);
		if (clubId && clubId > 0) {
			const clubData = await getClubData(clubId);
			fs.mkdirSync(CLUBS_CACHE_FOLDER, { recursive: true });
			fs.writeFileSync(cacheFile, JSON.stringify(clubData.response));
			return clubData.response.logo;
		}
	} else {
		const cacheContent = fs.readFileSync(cacheFile);
		const content = JSON.parse(cacheContent.toString());
		return content.logo;
	}
}

// funtion to retrieve the club id when provided with the clubs name
export async function getClubId(clubName: string): Promise<number | void> {
	// check if the cache file exists, if not then fetch it
	if (!fs.existsSync(path.join(CLUBS_FILE_TARGET))) {
		console.log("🚨 Clubs cache cannot be found!");
	}
	// read the cache file containing all clubs
	if (fs.existsSync(path.join(CLUBS_FILE_TARGET))) {
		const allClubsDataFile = fs.readFileSync(path.join(CLUBS_FILE_TARGET));
		const allClubsData = JSON.parse(allClubsDataFile.toString()).sportsclubs.sportsclub;
		// return the ID for the club in question
		const filteredClub = allClubsData.filter((club: { name: string }) => club.name == clubName);
		return filteredClub[0].id;
	}
}
