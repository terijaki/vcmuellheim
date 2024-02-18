import { env } from "process";
import fs from "fs";
import path from "path";
import { slugify } from "../slugify";
import getClubData from "./getClubData";
import { isElementOfType } from "react-dom/test-utils";

const SAMS_API = env.SAMS_API,
	SAMS_URL = env.SAMS_URL,
	SAMS_FOLDER = "data/sams";

const CLUBS_FILE_TARGET = "data/sams/allClubs.json";
const CLUBS_CACHE_FOLDER = "data/sams/clubs";

// get the club's logo url
export async function getClubLogoUrl(clubName: string) {
	const clubSlug = slugify(clubName);
	if (!clubSlug.includes("rieselfeld")) {
		return true; // TEMP TO NOT SPAM THE API
	}

	if (!fs.existsSync(path.join(CLUBS_CACHE_FOLDER, clubSlug + ".json"))) {
		console.log("🕵️ " + clubName + " cache does not exist.");
		// get the club's ID
		const clubId = await getClubId(clubName);
		if (!clubId || clubId < 0) {
			console.log("no club id"); // TODO: fetch the all clubs data and try again
		} else if (clubId && clubId > 0) {
			const clubData = await getClubData(clubId);
			console.log(clubData);
		}
	}

	return clubName;
}

// funtion to retrieve the club id when provided with the clubs name
export async function getClubId(clubName: string): Promise<number | void> {
	// read the cache file containing all clubs
	const allClubsDataFile = fs.readFileSync(path.join(CLUBS_FILE_TARGET));
	const allClubsData = JSON.parse(allClubsDataFile.toString()).sportsclubs.sportsclub;
	// return the ID for the club in question
	const filteredClub = allClubsData.filter((club: { name: string }) => club.name == clubName);
	return filteredClub[0].id;
}

export async function cacheClubLogo(clubName: string) {
	const clubId = await getClubId(clubName); // TODO this return undefined instead of the clubs ID. might have to do how this function file is executed. calling the function ourside this function is fine

	console.log(clubId);

	if (!clubId) {
		throw "🚨 The function input (clubID) is not defined!";
	}
	const apiPath = SAMS_URL + "/xml/sportsclub.xhtml?apiKey=" + SAMS_API + "&sportsclubId=" + clubId;

	await fetch(apiPath)
		.then((response) => Promise.all([response.status, response.text()]))
		.then(([status, xmlData]) => {
			// verify the status code
			if (status == 200) {
				// unfortunately some errors such as rate limits, maintenance mode etc, come in as status 200 and then the error message is in the body
				if (!xmlData.includes("<error>")) {
					// verify the response includes our club ID
					if (xmlData.includes("<id>" + clubId + "</id>")) {
						const parseString = require("xml2js").parseString;
						parseString(xmlData, { explicitArray: false, ignoreAttrs: true, emptyTag: null }, async function (err: any, result: any) {
							if (!err) {
								console.log("✅ Club Data looks good. Logo should be availalbe at: " + result.sportsclub.logo.url);

								// write the club data into a cache file
								// data/sams/clubs/slug.json

								return result.sportsclub.logo.url;
							} else {
								console.log("🚨 COULD NOT CONVERT CLUB DATA XML TO JSON! 🚨");
								console.log(err);
								return false;
							}
						});
					} else {
						console.log("🚨 CLUB DATA RESPONSE BODY DID NOT INCLUDE THE CLUB ID " + clubId + ".🚨\nTHIS COULD INDICATE A MAINTENANCE OR SERVER ISSUE.");
						console.log(xmlData);
						return false;
					}
				} else {
					console.log("🚨 RECEIVED ERROR MESSAGE FOR CLUB DATA! 🚨");
					console.log(xmlData);
					return false;
				}
			} else {
				console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE FOR CLUB DATA! 🚨");
				return false;
			}
		});
	return true;

	// get club details
	// get sportsclub.logo.url
	// fetch image
	// save image as slub e.g. "VC 94 Haslach" => vc94haslach.jpg
	// done
}
