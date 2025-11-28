import { createContext, useContext, useEffect, useState } from "react";

// PKCE helper functions
function generateRandomString(length: number): string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
	const randomValues = new Uint8Array(length);
	crypto.getRandomValues(randomValues);
	return Array.from(randomValues)
		.map((v) => charset[v % charset.length])
		.join("");
}

async function sha256(plain: string): Promise<ArrayBuffer> {
	const encoder = new TextEncoder();
	const data = encoder.encode(plain);
	return crypto.subtle.digest("SHA-256", data);
}

function base64UrlEncode(arrayBuffer: ArrayBuffer): string {
	const bytes = new Uint8Array(arrayBuffer);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generatePKCEChallenge(verifier: string): Promise<string> {
	const hashed = await sha256(verifier);
	return base64UrlEncode(hashed);
}

// Fetch Cognito config from API
async function fetchCognitoConfig(): Promise<{
	region: string;
	clientId: string;
	hostedUi?: {
		baseUrl: string;
	};
}> {
	// Compute API URL based on environment and branch (same pattern as CDK)
	const hostname = typeof window !== "undefined" ? window.location.hostname : "";
	let apiUrl = "";

	if (hostname === "localhost" || hostname === "127.0.0.1") {
		// Local development: compute URL from environment and Git branch
		const environment = import.meta.env.VITE_CDK_ENVIRONMENT || "dev";
		const gitBranch = import.meta.env.VITE_GIT_BRANCH || ""; // Injected at build time from Git
		const isProd = environment === "prod";
		const isMainBranch = gitBranch === "main" || gitBranch === "";
		const branch = !isMainBranch ? gitBranch : "";
		const branchSuffix = branch ? `-${branch}` : "";
		const envPrefix = isProd ? "" : `${environment}${branchSuffix}-`;
		apiUrl = `https://${envPrefix}api.new.vcmuellheim.de/api`;
	} else {
		// Deployed: replace admin -> api in hostname
		const apiHostname = hostname.replace("-admin.", "-api.").replace("admin.", "api.");
		apiUrl = `https://${apiHostname}/api`;
	}

	console.log("Fetching Cognito config from:", `${apiUrl}/config.cognito`);
	const response = await fetch(`${apiUrl}/config.cognito`);
	if (!response.ok) {
		console.error("Failed to fetch config:", response.status, response.statusText);
		throw new Error(`Failed to fetch Cognito config from API: ${response.status}`);
	}

	const data = await response.json();
	console.log("Received config data:", data);

	const cognitoData = data.result?.data?.json;
	if (!cognitoData?.region || !cognitoData?.clientId) {
		console.error("Invalid Cognito config structure:", data);
		throw new Error("Invalid Cognito config received from API");
	}

	return {
		region: cognitoData.region,
		clientId: cognitoData.clientId,
		hostedUi: cognitoData.hostedUi,
	};
}

interface AuthUser {
	username: string;
	email?: string;
	name?: string;
	idToken: string;
	accessToken: string;
	refreshToken?: string;
}

export interface AuthContext {
	user: AuthUser | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	idToken: string | null;
	configLoaded: boolean;
	redirectToLogin: () => void;
	logout: () => void;
	handleCallback: (code: string, state: string) => Promise<void>;
	error: string | null;
}

const AuthContext = createContext<AuthContext | undefined>(undefined);

const AUTH_STORAGE_KEY = "vcm-auth";
const PKCE_VERIFIER_KEY = "vcm-pkce-verifier";
const OAUTH_STATE_KEY = "vcm-oauth-state";

let cognitoConfig: Awaited<ReturnType<typeof fetchCognitoConfig>> | null = null;

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [configLoaded, setConfigLoaded] = useState(false);

	// Fetch Cognito config on mount
	useEffect(() => {
		fetchCognitoConfig()
			.then((config) => {
				cognitoConfig = config;
				setConfigLoaded(true);
			})
			.catch((err) => {
				console.error("Failed to load Cognito config:", err);
				setError("Failed to load authentication configuration");
				setIsLoading(false);
			});
	}, []);

	// Restore session from localStorage once config is loaded
	useEffect(() => {
		if (!configLoaded) return;

		const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
		if (storedAuth) {
			try {
				const authData = JSON.parse(storedAuth);
				setUser(authData);
			} catch {
				localStorage.removeItem(AUTH_STORAGE_KEY);
			}
		}
		setIsLoading(false);
	}, [configLoaded]);

	const redirectToLogin = async () => {
		if (!cognitoConfig?.hostedUi) {
			setError("Hosted UI not configured");
			return;
		}

		// Generate PKCE verifier and challenge
		const verifier = generateRandomString(128);
		const challenge = await generatePKCEChallenge(verifier);
		const state = generateRandomString(32);

		// Store verifier and state for callback
		sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
		sessionStorage.setItem(OAUTH_STATE_KEY, state);

		// Build login URL with PKCE and German locale
		const callbackUrl = `${window.location.origin}/auth/callback`;
		const loginUrl = `${cognitoConfig.hostedUi.baseUrl}/login?lang=de&client_id=${cognitoConfig.clientId}&response_type=code&scope=email+openid+profile&redirect_uri=${encodeURIComponent(callbackUrl)}&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;

		// Redirect to Cognito Hosted UI
		window.location.href = loginUrl;
	};

	// Properly decode JWT payload with UTF-8 support
	function decodeJwtPayload(token: string) {
		const base64 = token.split(".")[1];
		const base64Url = base64.replace(/-/g, "+").replace(/_/g, "/");
		const jsonPayload = decodeURIComponent(
			atob(base64Url)
				.split("")
				.map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
				.join(""),
		);
		return JSON.parse(jsonPayload);
	}

	const handleCallback = async (code: string, state: string) => {
		if (!cognitoConfig?.hostedUi) {
			setError("Hosted UI not configured");
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			// Verify state
			const storedState = sessionStorage.getItem(OAUTH_STATE_KEY);
			if (state !== storedState) {
				throw new Error("Invalid state parameter - possible CSRF attack");
			}

			// Get PKCE verifier
			const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
			if (!verifier) {
				throw new Error("PKCE verifier not found");
			}

			// Exchange code for tokens
			const callbackUrl = `${window.location.origin}/auth/callback`;
			const tokenUrl = `${cognitoConfig.hostedUi.baseUrl}/oauth2/token`;

			const tokenResponse = await fetch(tokenUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					grant_type: "authorization_code",
					client_id: cognitoConfig.clientId,
					code,
					redirect_uri: callbackUrl,
					code_verifier: verifier,
				}),
			});

			if (!tokenResponse.ok) {
				const errorText = await tokenResponse.text();
				console.error("Token exchange failed:", errorText);
				throw new Error(`Token exchange failed: ${tokenResponse.status}`);
			}

			const tokens = await tokenResponse.json();

			if (!tokens.id_token || !tokens.access_token) {
				throw new Error("Invalid token response");
			}

			// Decode JWT to get user info (with UTF-8 support)
			const payload = decodeJwtPayload(tokens.id_token);
			console.log("Decoded ID token payload:", payload);

			const authUser: AuthUser = {
				username: payload["cognito:username"] || payload.email,
				email: payload.email,
				name: `${payload.given_name || ""} ${payload.family_name || ""}`.trim(),
				idToken: tokens.id_token,
				accessToken: tokens.access_token,
				refreshToken: tokens.refresh_token,
			};

			setUser(authUser);
			localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));

			// Clear PKCE data
			sessionStorage.removeItem(PKCE_VERIFIER_KEY);
			sessionStorage.removeItem(OAUTH_STATE_KEY);
		} finally {
			setIsLoading(false);
		}
	};

	const logout = () => {
		setUser(null);
		localStorage.removeItem(AUTH_STORAGE_KEY);
		sessionStorage.removeItem(PKCE_VERIFIER_KEY);
		sessionStorage.removeItem(OAUTH_STATE_KEY);

		// Redirect to Cognito logout URL
		if (cognitoConfig?.hostedUi) {
			const logoutUrl = `${window.location.origin}/bye`;
			const cognitoLogoutUrl = `${cognitoConfig.hostedUi.baseUrl}/logout?client_id=${cognitoConfig.clientId}&logout_uri=${encodeURIComponent(logoutUrl)}&lang=de`;
			window.location.href = cognitoLogoutUrl;
		}
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				isLoading,
				isAuthenticated: !!user,
				idToken: user?.idToken ?? null,
				configLoaded,
				redirectToLogin,
				logout,
				handleCallback,
				error,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
