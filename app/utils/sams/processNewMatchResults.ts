import fs from "fs";
import path from "path";
import { SOCIAL_CACHE_FOLDER, SOCIAL_CACHE_FILE } from "./identifyNewMatchResults";

if (fs.existsSync(path.join(SOCIAL_CACHE_FOLDER, SOCIAL_CACHE_FILE))) {
	console.log("⭐️⭐️⭐️⭐️⭐️⭐️");
}
