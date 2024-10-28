//
// This file contains variables which are required for several features across the project. They are influenced from external factors and they are put here to easily change these from a central location. They are not sensitive in any way and we are not using environmental variables here for this reason.
//
/** General information about the club. */
export const Club = {
	domain: "vcmuellheim.de",
	url: "https://vcmuellheim.de",
	name: "Volleyballclub Müllheim e.V.",
	shortName: "VC Müllheim",
	email: "info@vcmuellheim.de",
};
/** The clubs details on the SAMS platform. */
export const SAMS = {
	url: samsUrl(),
	vereinsnummer: 3530, // in 2024 SAMS united across federal states and since then this is the "internalSportsclubId" and no longer the "clubId"
	name: "VC Müllheim",
};
/** The clubs identity/account on the fediverse. */
export const Mastodon = {
	instance: "freiburg.social",
	name: "VCM",
	clientId: "109553572668731614",
};

function samsUrl() {
	if (process.env.NODE_ENV != "production") return "https://www.volleyball-baden.de";
	return "http://localhost:3080/sams/mockup/";
}
