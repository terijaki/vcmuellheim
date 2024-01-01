// npx tsx --env-file=.env.local --env-file=.env app/utils/samsGetClubData.ts
import { env } from "process";

const samsApi = env.SAMS_API;
const samsUrl = env.SAMS_URL;
const samsClubId = env.SAMS_CLUBID;

console.log("hello");

// fet clubData
const apiPath = samsUrl + "/xml/sportsclub.xhtml?apiKey=" + samsApi + "&sportsclubId=" + samsClubId;
console.log(apiPath);

fetch(apiPath).then((response) => {
	// Our handler throws an error if the request did not succeed.
	if (!response.ok) {
		throw new Error(`HTTP error: ${response.status}`);
	} else {
		console.log(response);
	}
});
