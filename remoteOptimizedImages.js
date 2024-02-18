//In order for the image optimization at build time to work correctly, you have to specify all remote image urls in a file called remoteOptimizedImages.js in the root directory of your project (where the next.config.js is stored as well). The file should export an array of strings containing the urls of the remote images. Returning a promise of such array is also supported.

module.exports = new Promise(async (resolve) => {
	const fs = require("fs");
	const path = require("path");
	const CLUBS_CACHE_FOLDER = "data/sams/clubs";

	if (fs.existsSync(CLUBS_CACHE_FOLDER)) {
		let clubImages = new Set();

		const clubs = fs.readdirSync(CLUBS_CACHE_FOLDER);
		clubs.map((clubFile) => {
			const clubFileContent = fs.readFileSync(path.join(CLUBS_CACHE_FOLDER, clubFile));
			const clubData = JSON.parse(clubFileContent.toString());

			if (clubData.logo) {
				clubImages.add(clubData.logo);
			}
		});
		let clubImageArray = Array.from(clubImages);
		if (clubImageArray.length == 0) {
			clubImageArray = []; // serve empty array if there is no logo found
		}
		resolve(clubImageArray);
	}
	resolve([]);
});
