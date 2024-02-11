import { env } from "process";
import fs from "fs";

const SAMS_API = env.SAMS_API,
	SAMS_URL = env.SAMS_URL;

export function getClubs() {
	const apiPath = SAMS_URL + "/xml/sportsclubList.xhtml?apiKey=" + SAMS_API;
	// write response to file
	// done
}

export function getClubId(clubName: string): number {
	// get the cache
	// find matching name
	//return Id

	return 1234;
}

export function cacheClubLogo(clubId: number) {
	const apiPath = SAMS_URL + "/xml/sportsclub.xhtml?apiKey=" + SAMS_API + "&sportsclubId=" + clubId;
	// get club details
	// get sportsclub.logo.url
	// fetch image
	// save image as slub e.g. "VC 94 Haslach" => vc94haslach.jpg
	// done
}
