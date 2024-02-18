// Remote logo images  should be cache during and build time and to do so next-image-export-optimizer requires a list of all remote images to be added to remoteOptimizedImages.js
module.export = function listRemoteClubLogos() {
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
		return Array.from(clubImages);
	}
};
