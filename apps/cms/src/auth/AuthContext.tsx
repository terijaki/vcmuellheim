import { type AuthFlowType, CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import { createContext, useContext, useEffect, useState } from "react";

// Cognito configuration from CDK outputs
const COGNITO_REGION = "eu-central-1";
const COGNITO_CLIENT_ID = "54j8lkkhoqroscf5f99jcv87qu";

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

const cognitoClient = new CognitoIdentityProviderClient({
	region: COGNITO_REGION,
});

const AUTH_STORAGE_KEY = "vcm-auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Restore session from localStorage on mount
	useEffect(() => {
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
	}, []);

	const login = async (username: string, password: string) => {
		setIsLoading(true);
		setError(null);

		try {
			const command = new InitiateAuthCommand({
				AuthFlow: "USER_PASSWORD_AUTH" as AuthFlowType,
				ClientId: COGNITO_CLIENT_ID,
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
