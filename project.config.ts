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
	slug: "vcmuellheim" as const,
};
/** The clubs details on the SAMS platform. */
export const SAMS = {
	name: "VC Müllheim" as const,
	server: "https://www.volleyball-baden.de" as const,
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
	mainAccount: "vcmuellheim" as const,
	beholdFeedUrl: "https://feeds.behold.so/X3Yv8tq2h6eumDnoiywZ" as const,
};
/** Shared Sentry configuration for the webapp runtime. */
export const Sentry = {
	dsn: "https://fa39728bab836eac8258598505b891fe@o4509428230979584.ingest.de.sentry.io/4509428234322000" as const,
};
/** AWS DNS resources (manually created in AWS Console, environment-specific). */
export const DNS = {
	// Production DNS (root domain vcmuellheim.de)
	prod: {
		hostedZoneId: "Z07941341PJZD0BLY5RYX" as const,
		hostedZoneName: "vcmuellheim.de" as const,
		certificateArn: "arn:aws:acm:eu-central-1:041632640830:certificate/049df86f-2947-466c-b967-095e95787365" as const,
		cloudFrontCertificateArn: "arn:aws:acm:us-east-1:041632640830:certificate/2488548d-c3fd-457c-b12b-79124df49ae6" as const,
	},
	// Development DNS (new.vcmuellheim.de subdomain)
	dev: {
		hostedZoneId: "Z03321631DB0YW48LDV0Z" as const,
		hostedZoneName: "new.vcmuellheim.de" as const,
		certificateArn: "arn:aws:acm:eu-central-1:418553863544:certificate/10ad4348-defc-4490-a8f2-e6a2809536b6" as const,
		cloudFrontCertificateArn: "arn:aws:acm:us-east-1:418553863544:certificate/6de199cf-4cf8-4833-aa5e-bae58f3fe6a7" as const,
	},
} as const;
/** AWS Lambda layer ARNs (manually published, environment-specific). */
export const LambdaLayers = {
	prod: {
		imageMagick: "arn:aws:lambda:eu-central-1:041632640830:layer:image-magick:1" as const,
	},
	dev: {
		imageMagick: "arn:aws:lambda:eu-central-1:418553863544:layer:image-magick:1" as const,
	},
} as const;
