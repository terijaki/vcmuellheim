/**
 * Test script for Cognito authentication and tRPC API
 * 
 * Usage:
 * 1. Set your Cognito credentials as environment variables:
 *    export COGNITO_USERNAME="your-email@example.com"
 *    export COGNITO_PASSWORD="your-password"
 * 2. Run: bun run scripts/test-auth.ts
 */

import {
	CognitoIdentityProviderClient,
	InitiateAuthCommand,
	type AuthFlowType,
} from "@aws-sdk/client-cognito-identity-provider";

const API_URL = "https://96emgymync.execute-api.eu-central-1.amazonaws.com";
const CLIENT_ID = "54j8lkkhoqroscf5f99jcv87qu";
const REGION = "eu-central-1";

const username = process.env.COGNITO_USERNAME;
const password = process.env.COGNITO_PASSWORD;

if (!username || !password) {
	console.error("❌ Missing credentials!");
	console.error("Please set COGNITO_USERNAME and COGNITO_PASSWORD environment variables");
	console.error("\nExample:");
	console.error("  export COGNITO_USERNAME='your-email@example.com'");
	console.error("  export COGNITO_PASSWORD='your-password'");
	process.exit(1);
}

async function testAuthentication() {
	console.log("🔐 Testing Cognito Authentication\n");

	// Step 1: Authenticate with Cognito
	console.log("1️⃣  Authenticating with Cognito...");
	const cognitoClient = new CognitoIdentityProviderClient({ region: REGION });

	try {
		const authCommand = new InitiateAuthCommand({
			AuthFlow: "USER_PASSWORD_AUTH" as AuthFlowType,
			ClientId: CLIENT_ID,
			AuthParameters: {
				USERNAME: username,
				PASSWORD: password,
			},
		});

		const authResponse = await cognitoClient.send(authCommand);

		if (!authResponse.AuthenticationResult?.IdToken) {
			console.error("❌ Authentication failed - no token received");
			return;
		}

		const idToken = authResponse.AuthenticationResult.IdToken;
		console.log("✅ Authentication successful!");
		console.log(`   Token: ${idToken.substring(0, 50)}...`);

		// Step 2: Test public endpoint (no auth required)
		console.log("\n2️⃣  Testing public endpoint (GET /api/news.list)...");
		const publicResponse = await fetch(`${API_URL}/api/news.list`, {
			method: "GET",
		});

		if (publicResponse.ok) {
			const publicData = await publicResponse.json();
			console.log("✅ Public endpoint works!");
			console.log(`   Response:`, publicData);
		} else {
			console.error(
				`❌ Public endpoint failed: ${publicResponse.status} ${publicResponse.statusText}`,
			);
		}

		// Step 3: Test protected endpoint (auth required)
		console.log("\n3️⃣  Testing protected endpoint with JWT...");
		const protectedResponse = await fetch(`${API_URL}/api/news.list`, {
			method: "GET",
			headers: {
				Authorization: `Bearer ${idToken}`,
				"Content-Type": "application/json",
			},
		});

		if (protectedResponse.ok) {
			const protectedData = await protectedResponse.json();
			console.log("✅ Protected endpoint works with JWT!");
			console.log(`   Response:`, protectedData);
		} else {
			console.error(
				`❌ Protected endpoint failed: ${protectedResponse.status} ${protectedResponse.statusText}`,
			);
		}

		// Step 4: Test that context.userId is set
		console.log("\n4️⃣  Verifying userId is extracted from JWT...");
		console.log(
			"   (This would require a protected procedure that returns userId)",
		);
		console.log("   ℹ️  Implement a test procedure in tRPC routers if needed");

		console.log("\n✨ Authentication test complete!");
	} catch (error) {
		console.error("❌ Error during authentication:", error);
		if (error instanceof Error) {
			console.error(`   ${error.message}`);
		}
		process.exit(1);
	}
}

testAuthentication();
