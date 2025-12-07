/**
 * tRPC context - available to all procedures
 * LAZY JWT VERIFICATION: Token verification is deferred to protected procedures for performance
 */

import { Logger } from "@aws-lambda-powertools/logger";
import { decode, verify } from "jsonwebtoken";
import { JwksClient } from "jwks-rsa";

export type UserRole = "Admin" | "Moderator";

export interface Context {
	// Lazy-loaded: Only populated after JWT verification in protected procedures
	userId?: string; // From Cognito when authenticated
	userRole?: UserRole; // User's role from Cognito groups
	userEmail?: string; // User's email

	// Raw auth data: Used for lazy JWT verification in protected procedures
	authorizationHeader?: string;
	userPoolId?: string;
	region?: string;
}

interface CreateContextOptions {
	authorizationHeader?: string;
	userPoolId?: string;
	region?: string;
}

const logger = new Logger({ serviceName: "vcm-jwt" });

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

/**
 * Verify JWT token with JWKS lookup
 * Called lazily only for protected/admin procedures to avoid unnecessary Cognito calls
 * @param token JWT token string
 * @param userPoolId Cognito user pool ID
 * @param region AWS region
 * @returns Decoded JWT payload or null if verification fails
 */
export async function verifyJwt(token: string, userPoolId: string, region: string): Promise<CognitoJwtPayload | null> {
	try {
		const client = getJwksClient(region, userPoolId);

		// Decode token header to get kid (key ID) without verification
		const decoded = decode(token, { complete: true });
		if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
			logger.warn("Failed to decode JWT header");
			return null;
		}
		const kid = decoded.header.kid;

		// Get signing key from JWKS
		const key = await client.getSigningKey(kid);
		const signingKey = key.getPublicKey();

		// Verify token signature and claims
		const payload = verify(token, signingKey, {
			algorithms: ["RS256"],
			issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
		}) as CognitoJwtPayload;

		logger.debug("JWT verification successful");
		return payload;
	} catch (error) {
		logger.error("JWT verification failed", { error: String(error) });
		return null;
	}
}

export async function createContext(opts: CreateContextOptions = {}): Promise<Context> {
	const { authorizationHeader, userPoolId, region } = opts;

	// LAZY JWT VERIFICATION:
	// Simply return context with raw auth data
	// Token verification happens in protectedProcedure/adminProcedure middleware only
	// This saves latency on every public route request that doesn't need auth

	return {
		// Raw auth data for lazy verification in protected procedures
		authorizationHeader,
		userPoolId,
		region,
		// Unauthenticated by default (no userId)
		userId: undefined,
	};
}
