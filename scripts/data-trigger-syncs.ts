// Script to trigger SAMS sync Lambda functions (associations, clubs, teams)
// See docs/SAMS_API_TESTING.md for details

import { execSync } from "node:child_process";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

// Check for active AWS session
function checkAwsSession() {
	try {
		execSync("aws sts get-caller-identity", { stdio: "ignore" });
	} catch (_err) {
		console.error("❌ No active AWS session found. Please run 'aws login' or authenticate with AWS CLI.");
		process.exit(1);
	}
}
checkAwsSession();

import { getSanitizedBranch } from "@/utils/git";

// Read environment and branch from env vars or use defaults
const ENVIRONMENT = process.env.CDK_ENVIRONMENT || "dev";
const BRANCH = ENVIRONMENT === "prod" ? "" : getSanitizedBranch();
const REGION = process.env.CDK_REGION || "eu-central-1";
process.env.AWS_PROFILE = "vcmuellheim";

/** List of SAMS sync Lambda functions to invoke */
const lambdaNames = [`sams-clubs-sync`, `sams-teams-sync`].map((e) => `${e}-${ENVIRONMENT}-${BRANCH}`);

const client = new LambdaClient({ region: REGION });

async function invokeSync(name: string) {
	try {
		const cmd = new InvokeCommand({
			FunctionName: name,
			InvocationType: "RequestResponse",
			Payload: Buffer.from("{}"),
		});
		const result = await client.send(cmd);
		const payload = result.Payload ? Buffer.from(result.Payload).toString() : "";
		console.log(`✅ Invoked ${name}`);
		if (payload) {
			console.log(payload);
		}
		return true;
	} catch (err) {
		console.error(`❌ Failed to invoke ${name}`);
		console.error(err);
		return false;
	}
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
	console.log("=== Triggering SAMS sync Lambdas ===\n");
	for (const [i, name] of lambdaNames.entries()) {
		await invokeSync(name);
		if (i < lambdaNames.length - 1) {
			console.log("Waiting 10 seconds before next sync...");
			await sleep(10000);
		}
	}
	console.log("\n=== All syncs triggered ===");
}

main();
