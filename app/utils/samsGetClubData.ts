// npx tsx --env-file=.env.local --env-file=.env app/utils/samsGetClubData.ts
// http://wiki.sams-server.de/wiki/XML-Schnittstelle
import { env } from "process";
import fs from "fs";

const SAMS_API = env.SAMS_API;
const SAMS_URL = env.SAMS_URL;
const SAMS_CLUB_ID = env.SAMS_CLUBID;
const JSON_FILE_TARGET = "data/sams/club.json";

// fetch Club Data
const apiPath = SAMS_URL + "/xml/sportsclub.xhtml?apiKey=" + SAMS_API + "&sportsclubId=" + SAMS_CLUB_ID;
fetch(apiPath)
	.then((response) => Promise.all([response.status, response.text()]))
	.then(([status, xmlData]) => {
		console.log("STATUS RESPONSE CODE:" + status);
		if (status == 200) {
			if (xmlData.includes("<id>" + SAMS_CLUB_ID + "</id>")) {
				const parseString = require("xml2js").parseString;
				parseString(xmlData, function (err: any, result: any) {
					if (!err) {
						console.log("✅ All good. Writing response to JSON file.");
						fs.writeFileSync(JSON_FILE_TARGET, JSON.stringify(result, null, 2));
					} else {
						console.log("🚨 COULD NOT CONVERT XML TO JSON! 🚨");
						console.log(err);
					}
				});
			} else {
				console.log("🚨 RESPONSE BODY DID NOT INCLUDE OUR CLUB ID.🚨\nTHIS COULD INDICATE A MAINTENANCE OR SERVER ISSUE.");
				console.log(xmlData);
			}
		} else {
			console.log("🚨 DID NOT RECEIVE A HTTP 200 RESPONSE! 🚨");
		}
	});
