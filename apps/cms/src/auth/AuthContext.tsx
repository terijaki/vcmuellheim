import { type AuthFlowType, CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { createContext, useContext, useEffect, useState } from "react";

// Fetch Cognito config from API
async function fetchCognitoConfig(): Promise<{ region: string; clientId: string }> {
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
	};
}

interface AuthUser {
	username: string;
	email?: string;
	idToken: string;
	accessToken: string;
	refreshToken?: string;
}

interface AuthContextType {
	user: AuthUser | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	idToken: string | null;
	login: (username: string, password: string) => Promise<void>;
	logout: () => void;
	error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "vcm-auth";

let cognitoClient: CognitoIdentityProviderClient | null = null;
let cognitoClientId = "";

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [configLoaded, setConfigLoaded] = useState(false);

	// Fetch Cognito config on mount
	useEffect(() => {
		fetchCognitoConfig()
			.then((config) => {
				cognitoClient = new CognitoIdentityProviderClient({ region: config.region });
				cognitoClientId = config.clientId;
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

	const login = async (username: string, password: string) => {
		if (!cognitoClient || !cognitoClientId) {
			setError("Authentication not initialized");
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const command = new InitiateAuthCommand({
				AuthFlow: "USER_PASSWORD_AUTH" as AuthFlowType,
				ClientId: cognitoClientId,
				AuthParameters: {
					USERNAME: username,
					PASSWORD: password,
				},
			});

			const response = await cognitoClient.send(command);

			if (!response.AuthenticationResult) {
				throw new Error("Authentication failed - no tokens received");
			}

			const { IdToken, AccessToken, RefreshToken } = response.AuthenticationResult;

			if (!IdToken || !AccessToken) {
				throw new Error("Invalid authentication response");
			}

			// Decode JWT to get user info (basic decode, no verification needed here)
			const payload = JSON.parse(atob(IdToken.split(".")[1]));

			const authUser: AuthUser = {
				username,
				email: payload.email,
				idToken: IdToken,
				accessToken: AccessToken,
				refreshToken: RefreshToken,
			};

			setUser(authUser);
			localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Login failed";
			setError(errorMessage);
			throw err;
		} finally {
			setIsLoading(false);
		}
	};

	const logout = () => {
		setUser(null);
		localStorage.removeItem(AUTH_STORAGE_KEY);
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				isLoading,
				isAuthenticated: !!user,
				idToken: user?.idToken ?? null,
				login,
				logout,
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
