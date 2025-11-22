/**
 * tRPC context - available to all procedures
 */

export interface Context {
	userId?: string; // From Cognito when authenticated
}

export async function createContext(): Promise<Context> {
	// TODO: Extract userId from Cognito JWT token when implementing auth
	return {
		userId: undefined,
	};
}
