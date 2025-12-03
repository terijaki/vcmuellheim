/**
 * Compute environment prefix for API URLs based on CDK environment and git branch
 * @returns URL prefix like "dev-cool-feature-" or "" for production
 */
function getEnvPrefix(): string {
	const environment = import.meta.env.VITE_CDK_ENVIRONMENT || "dev";
	const gitBranch = import.meta.env.VITE_GIT_BRANCH || "";
	const isProd = environment === "prod";
	const isMainBranch = gitBranch === "main" || gitBranch === "";
	const branch = !isMainBranch ? gitBranch : "";
	const branchSuffix = branch ? `-${branch}` : "";
	return isProd ? "" : `${environment}${branchSuffix}-`;
}

/**
 * Generic function to build API URLs for different services.
 * Handles hostname transformation from website/admin domains to service-specific domains.
 * @param service - The service subdomain (api, sams, social)
 * @param pathSuffix - Optional path to append (e.g., "/api")
 * @returns Full URL to the service
 * @example
 * ```ts
 * const apiUrl = buildServiceUrl("api", "/api"); // Get tRPC API URL
 * const samsUrl = buildServiceUrl("sams"); // e.g. https://dev-new-feature-sams.vcmuellheim.de
 * ```
 */
export function buildServiceUrl(service: "api" | "sams" | "social", pathSuffix = ""): string {
	if (typeof window === "undefined") return "";

	const hostname = window.location.hostname;
	const envPrefix = getEnvPrefix();
	const environment = import.meta.env.VITE_CDK_ENVIRONMENT || "dev";
	const isProd = environment === "prod";
	const baseDomain = isProd ? "vcmuellheim.de" : "new.vcmuellheim.de";
	const baseUrl = `https://${envPrefix}${service}.${baseDomain}${pathSuffix}`;

	// If running on localhost, use the deployed service URL
	if (hostname === "localhost" || hostname === "127.0.0.1") {
		return baseUrl;
	}

	// Transform hostname: replace -website/-admin with -service, or append -service
	let serviceHostname: string;
	if (hostname.includes("-website.")) {
		serviceHostname = hostname.replace("-website.", `-${service}.`);
	} else if (hostname.includes("-admin.")) {
		serviceHostname = hostname.replace("-admin.", `-${service}.`);
	} else if (hostname.startsWith("admin.") && !hostname.includes("new.")) {
		// Production: admin.vcmuellheim.de -> api.vcmuellheim.de
		serviceHostname = hostname.replace("admin.", `${service}.`);
	} else if (hostname === "vcmuellheim.de") {
		// Production root: vcmuellheim.de -> api.vcmuellheim.de
		serviceHostname = `${service}.vcmuellheim.de`;
	} else {
		// If the domain doesn't have -website or -admin, append -service to the environment prefix
		// Example: dev-aws-migration.new.vcmuellheim.de -> dev-aws-migration-api.new.vcmuellheim.de
		const parts = hostname.split(".");
		if (parts.length > 0 && parts[0] !== "new") {
			parts[0] = `${parts[0]}-${service}`;
			serviceHostname = parts.join(".");
		} else {
			serviceHostname = hostname.replace("new.", `${service}.new.`);
		}
	}
	return `https://${serviceHostname}${pathSuffix}`;
}

/**
 * Get the hostname (without protocol) for ICS calendar feeds
 * Returns the API domain where the /ics routes are hosted
 */
export function getIcsHostname(): string {
	if (typeof window === "undefined") return "";

	const hostname = window.location.hostname;
	const envPrefix = getEnvPrefix();
	const environment = import.meta.env.VITE_CDK_ENVIRONMENT || "dev";
	const isProd = environment === "prod";
	const baseDomain = isProd ? "vcmuellheim.de" : "new.vcmuellheim.de";

	// If running on localhost, use the deployed API domain
	if (hostname === "localhost" || hostname === "127.0.0.1") {
		return `${envPrefix}api.${baseDomain}`;
	}

	// Transform hostname to API domain
	if (hostname.includes("-website.")) {
		return hostname.replace("-website.", "-api.");
	}
	if (hostname.includes("-admin.")) {
		return hostname.replace("-admin.", "-api.");
	}
	if (hostname.startsWith("admin.") && !hostname.includes("new.")) {
		// Production: admin.vcmuellheim.de -> api.vcmuellheim.de
		return hostname.replace("admin.", "api.");
	}
	if (hostname === "vcmuellheim.de") {
		// Production root: vcmuellheim.de -> api.vcmuellheim.de
		return "api.vcmuellheim.de";
	}
	// If the domain doesn't have -website or -admin, append -api to the environment prefix
	const parts = hostname.split(".");
	if (parts.length > 0 && parts[0] !== "new") {
		parts[0] = `${parts[0]}-api`;
		return parts.join(".");
	}
	return hostname.replace("new.", "api.new.");
}
