import fs from "fs";
import path from "path";
import { SOCIAL_CACHE_FOLDER, SOCIAL_CACHE_FILE } from "./identifyNewMatchResults";
import { socialMatchesCache, socialMatchesEntry } from "../social/typeCache";
import { error } from "console";

const cacheFile = path.join(SOCIAL_CACHE_FOLDER, SOCIAL_CACHE_FILE);

if (fs.existsSync(cacheFile)) {
	const matches: socialMatchesCache = JSON.parse(fs.readFileSync(cacheFile).toString());

	matches.entries.forEach((match) => {
		if (match.mastodon != "published") {
			try {
				console.log("🕵️ Processing " + match.team[0] + " : " + match.team[1] + " (" + match.uuid + ") from " + new Date(match.date).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" }));

				// send to mastodon function
				// set to queued
				// away response
				// set to published
				// update the file
			} catch (error) {
				console.log("🚨 Unable to process " + match.uuid + " from " + new Date(match.date).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" }));
				console.log(error);
			}
		}
	});

	console.log("⭐️⭐️⭐️⭐️⭐️⭐️");
}
