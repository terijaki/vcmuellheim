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
 * API URL configuration for the CMS and Website application
 * Supports environment-aware local development via VITE_CDK_ENVIRONMENT and VITE_GIT_BRANCH
 */
export function getApiUrl(): string {
	if (typeof window === "undefined") return "";

	const hostname = window.location.hostname;
	const envPrefix = getEnvPrefix();
	const baseApiUrl = `https://${envPrefix}api.new.vcmuellheim.de/api`;

	// If running on localhost, use the full apiUrl
	if (hostname === "localhost" || hostname === "127.0.0.1") {
		return baseApiUrl;
	}

	// Replace either -website. or -admin. with -api.
	let apiHostname = hostname;
	if (hostname.includes("-website.")) {
		apiHostname = hostname.replace("-website.", "-api.");
	} else if (hostname.includes("-admin.")) {
		apiHostname = hostname.replace("-admin.", "-api.");
	}
	return `https://${apiHostname}`;
}

/**
 * SAMS API URL configuration for the SAMS API
 * Supports environment-aware local development via VITE_CDK_ENVIRONMENT and VITE_GIT_BRANCH
 */
export function getSamsApiUrl(): string {
	if (typeof window === "undefined") return "";

	const hostname = window.location.hostname;
	const envPrefix = getEnvPrefix();
	const baseApiUrl = `https://${envPrefix}sams.new.vcmuellheim.de`;

	// If running on localhost, use the full apiUrl
	if (hostname === "localhost" || hostname === "127.0.0.1") {
		return baseApiUrl;
	}

	// Replace either -website. or -admin. with -api.
	let samsApiHostname = hostname;
	if (hostname.includes("-website.")) {
		samsApiHostname = hostname.replace("-website.", "-sams.");
	} else if (hostname.includes("-admin.")) {
		samsApiHostname = hostname.replace("-admin.", "-sams.");
	}
	return `https://${samsApiHostname}`;
}
