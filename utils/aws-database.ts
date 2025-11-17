/**
 * AWS Database Connection Utility
 * 
 * This utility helps retrieve database credentials from AWS Secrets Manager
 * and construct the DATABASE_URL for use with Payload CMS.
 * 
 * Usage in Next.js/Payload:
 * 
 * ```typescript
 * import { getDatabaseUrl } from './utils/aws-database';
 * 
 * const databaseUrl = await getDatabaseUrl();
 * ```
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

interface DatabaseCredentials {
  username: string;
  password: string;
}

/**
 * Retrieves database URL from environment or AWS Secrets Manager
 * 
 * Environment variables required:
 * - DATABASE_URL (if set, will be used directly)
 * - DATABASE_SECRET_ARN (ARN of the secret in Secrets Manager)
 * - AWS_REGION (AWS region, defaults to eu-central-1)
 * - DATABASE_ENDPOINT (Aurora cluster endpoint hostname)
 * - DATABASE_PORT (Database port, defaults to 5432)
 * - DATABASE_NAME (Database name, defaults to vcmuellheim)
 */
export async function getDatabaseUrl(): Promise<string> {
  // If DATABASE_URL is already set, use it directly
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Retrieve credentials from AWS Secrets Manager
  const secretArn = process.env.DATABASE_SECRET_ARN;
  if (!secretArn) {
    throw new Error(
      "DATABASE_URL or DATABASE_SECRET_ARN must be set in environment variables"
    );
  }

  const region = process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || "eu-central-1";
  const endpoint = process.env.DATABASE_ENDPOINT;
  const port = process.env.DATABASE_PORT || "5432";
  const database = process.env.DATABASE_NAME || "vcmuellheim";

  if (!endpoint) {
    throw new Error("DATABASE_ENDPOINT must be set in environment variables");
  }

  try {
    const client = new SecretsManagerClient({ region });
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretArn })
    );

    if (!response.SecretString) {
      throw new Error("Secret value is empty");
    }

    const credentials: DatabaseCredentials = JSON.parse(response.SecretString);

    // Construct PostgreSQL connection string
    const databaseUrl = `postgresql://${credentials.username}:${credentials.password}@${endpoint}:${port}/${database}`;

    return databaseUrl;
  } catch (error) {
    console.error("Failed to retrieve database credentials:", error);
    throw error;
  }
}

/**
 * For local development, you can use the standard DATABASE_URL environment variable.
 * For AWS deployments, ensure the following environment variables are set:
 * 
 * - DATABASE_SECRET_ARN (automatically set by CDK in Amplify)
 * - DATABASE_ENDPOINT (get from CDK outputs)
 * - AWS_REGION (automatically available in AWS environments)
 */
