import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { buildServiceUrl } from "../../../shared";

// Create the better-auth client
const authClient = createAuthClient({
	baseURL: buildServiceUrl("api", "/api/auth"),
	fetchOptions: {
		credentials: "include",
	},
	plugins: [emailOTPClient()],
});

interface AuthUser {
	id: string;
	email: string;
	name?: string;
	role?: "Admin" | "Moderator";
}

export interface AuthContext {
	user: AuthUser | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	/** @deprecated Use cookie-based auth. Kept for backwards compat (null with better-auth) */
	idToken: null;
	configLoaded: boolean;
	redirectToLogin: () => void;
	logout: () => Promise<void>;
	/** @deprecated OAuth callback no longer used. Use OTP flow instead. */
	handleCallback: (code: string, state: string) => Promise<void>;
	error: string | null;
	isLoggingOut: boolean;
	// OTP-specific methods
	sendOtp: (email: string) => Promise<void>;
	verifyOtp: (email: string, otp: string) => Promise<void>;
	otpSent: boolean;
	otpEmail: string | null;
}

const AuthCtx = createContext<AuthContext | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [otpSent, setOtpSent] = useState(false);
	const [otpEmail, setOtpEmail] = useState<string | null>(null);

	// Load session on mount
	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);

		authClient
			.getSession()
			.then((session) => {
				if (cancelled) return;
				if (session?.data?.user) {
					const u = session.data.user as { id: string; email: string; name?: string; role?: string };
					setUser({
						id: u.id,
						email: u.email,
						name: u.name,
						role: u.role as "Admin" | "Moderator" | undefined,
					});
				} else {
					setUser(null);
				}
			})
			.catch((err) => {
				if (cancelled) return;
				console.error("Failed to load session:", err);
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const redirectToLogin = useCallback(() => {
		// With better-auth OTP flow, login is shown inline — this is a no-op.
	}, []);

	const sendOtp = useCallback(async (email: string) => {
		setError(null);
		const result = await authClient.emailOtp.sendVerificationOtp({
			email,
			type: "sign-in",
		});
		if (result.error) {
			const message = result.error.message || "OTP konnte nicht gesendet werden";
			setError(message);
			throw new Error(message);
		}
		setOtpEmail(email);
		setOtpSent(true);
	}, []);

	const verifyOtp = useCallback(async (email: string, otp: string) => {
		setError(null);
		const result = await authClient.signIn.emailOtp({
			email,
			otp,
		});
		if (result.error) {
			const message = result.error.message || "OTP-Verifizierung fehlgeschlagen";
			setError(message);
			throw new Error(message);
		}
		// Reload session after successful login
		const session = await authClient.getSession();
		if (session?.data?.user) {
			const u = session.data.user as { id: string; email: string; name?: string; role?: string };
			setUser({
				id: u.id,
				email: u.email,
				name: u.name,
				role: u.role as "Admin" | "Moderator" | undefined,
			});
			setOtpSent(false);
			setOtpEmail(null);
		}
	}, []);

	const logout = useCallback(async () => {
		setIsLoggingOut(true);
		await authClient.signOut();
		setUser(null);
		setIsLoggingOut(false);
		window.location.href = "/bye";
	}, []);

	// @deprecated: no longer used with better-auth (cookie-based)
	const handleCallback = useCallback(async (_code: string, _state: string) => {
		// No-op: OAuth callback is no longer used
	}, []);

	return (
		<AuthCtx.Provider
			value={{
				user,
				isLoading,
				isAuthenticated: !!user,
				idToken: null,
				configLoaded: true,
				redirectToLogin,
				logout,
				handleCallback,
				error,
				isLoggingOut,
				sendOtp,
				verifyOtp,
				otpSent,
				otpEmail,
			}}
		>
			{children}
		</AuthCtx.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthCtx);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}
