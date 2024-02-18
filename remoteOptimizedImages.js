//In order for the image optimization at build time to work correctly, you have to specify all remote image urls in a file called remoteOptimizedImages.js in the root directory of your project (where the next.config.js is stored as well). The file should export an array of strings containing the urls of the remote images. Returning a promise of such array is also supported.

module.exports = new Promise(async (resolve) => {
	const listRemoteClubLogos = require("./app/utils/sams/listRemoteClubLogos.ts");
	resolve(await listRemoteClubLogos());
});
