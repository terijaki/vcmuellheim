//
// This file contains variables which are required for several features across the project. They are influenced from external factors and they are put here to easily change these from a central location. They are not sensitive in any way and we are not using environmental variables here for this reason.
//
/** General information about the club. */
export const Club = {
	domain: "vcmuellheim.de" as const,
	url: "https://vcmuellheim.de" as const,
	name: "Volleyballclub Müllheim e.V." as const,
	shortName: "VC Müllheim" as const,
	email: "info@vcmuellheim.de" as const,
	city: "Müllheim" as const,
	postalCode: 79379 as const,
};
/** The clubs details on the SAMS platform. */
export const SAMS = {
	name: "VC Müllheim" as const,
	server: process.env.SAMS_SERVER as string,
	association: { name: "Südbadischer Volleyball-Verband" as const, shortName: "SBVV" as const },
};
/** The clubs identity/account on the fediverse. */
export const Mastodon = {
	instance: "freiburg.social" as const,
	name: "VCM" as const,
	clientId: "109553572668731614" as const,
};
/** The clubs Instagram settings. */
export const Instagram = {
	recentPostTimeframe: 30 as const, // days
	mainAccount: "vcmuellheim" as const,
};
