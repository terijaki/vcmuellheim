/**
 * Compute tRPC API URL based on current hostname and app environment
 * This is used to automatically route requests to the correct API endpoint
 */

interface ApiUrlConfig {
	/** Hostname replacement for production/staging (e.g., 'website' -> 'api') */
	hostnameReplace: [string, string];
	/** API base URL (used when on localhost or in deployed environments) */
	apiUrl: string;
}

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

export function getApiUrl(config: ApiUrlConfig): string {
	if (typeof window === "undefined") return "";

	const hostname = window.location.hostname;

	// If running on localhost, use the full apiUrl
	if (hostname === "localhost" || hostname === "127.0.0.1") {
		return config.apiUrl;
	}

	// Production/staging: replace hostname pattern with api
	const apiHostname = hostname.replace(config.hostnameReplace[0], config.hostnameReplace[1]);
	return `https://${apiHostname}`;
}

/**
 * API URL configuration for the website application
 * Supports environment-aware local development via VITE_CDK_ENVIRONMENT and VITE_GIT_BRANCH
 */
export function getWebsiteApiConfig(): ApiUrlConfig {
	const envPrefix = getEnvPrefix();

	return {
		hostnameReplace: ["-website.", "-api."],
		apiUrl: `https://${envPrefix}api.new.vcmuellheim.de/api`,
	};
}

/**
 * API URL configuration for the CMS application
 * Supports environment-aware local development via VITE_CDK_ENVIRONMENT and VITE_GIT_BRANCH
 */
export function getCmsApiConfig(): ApiUrlConfig {
	const envPrefix = getEnvPrefix();

	return {
		hostnameReplace: ["-admin.", "-api."],
		apiUrl: `https://${envPrefix}api.new.vcmuellheim.de/api`,
	};
}
