/**
 * tRPC context - available to all procedures
 */

import { decode, verify } from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";

export type UserRole = "Admin" | "Moderator";

export interface Context {
	userId?: string; // From Cognito when authenticated
	userRole?: UserRole; // User's role from Cognito groups
	userEmail?: string; // User's email
}

interface CreateContextOptions {
	authorizationHeader?: string;
	userPoolId?: string;
	region?: string;
}

// Cache JWKS client
let jwksClient: JwksClient | null = null;

function getJwksClient(region: string, userPoolId: string): JwksClient {
	if (!jwksClient) {
		jwksClient = new JwksClient({
			jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
			cache: true,
			cacheMaxAge: 600000, // 10 minutes
		});
	}
	return jwksClient;
}

interface CognitoJwtPayload {
	sub: string; // User ID
	email?: string;
	"cognito:groups"?: string[]; // Cognito groups
	[key: string]: unknown;
}

async function verifyJwt(token: string, userPoolId: string, region: string): Promise<CognitoJwtPayload | null> {
	try {
		const client = getJwksClient(region, userPoolId);

		// Decode token header to get kid (key ID) without verification
		const decoded = decode(token, { complete: true });
		if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
			return null;
		}
		const kid = decoded.header.kid;

		// Get signing key from JWKS
		const key = await client.getSigningKey(kid);
		const signingKey = key.getPublicKey();

		// Verify token
		const payload = verify(token, signingKey, {
			algorithms: ["RS256"],
			issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
		}) as CognitoJwtPayload;

		return payload;
	} catch (error) {
		console.error("JWT verification failed:", error);
		return null;
	}
}

export async function createContext(opts: CreateContextOptions = {}): Promise<Context> {
	const { authorizationHeader, userPoolId, region } = opts;

	// Extract JWT token from Authorization header
	if (!authorizationHeader || !userPoolId || !region) {
		return { userId: undefined };
	}

	const token = authorizationHeader.replace(/^Bearer /i, "");
	if (!token) {
		return { userId: undefined };
	}

	// Verify JWT and extract userId, role, and email
	const payload = await verifyJwt(token, userPoolId, region);
	if (!payload) {
		return { userId: undefined, userRole: undefined, userEmail: undefined };
	}

	// Extract role from Cognito groups (first group takes precedence)
	const groups = payload["cognito:groups"] || [];
	const userRole: UserRole | undefined = groups.includes("Admin") ? "Admin" : groups.includes("Moderator") ? "Moderator" : undefined;

	return {
		userId: payload.sub,
		userRole,
		userEmail: payload.email,
	};
}
