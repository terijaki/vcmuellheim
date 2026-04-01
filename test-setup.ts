// Suppress Powertools structured log output during tests
process.env.POWERTOOLS_LOG_LEVEL = "SILENT";

// Suppress jsii deprecation warnings from aws-cdk-lib
process.env.JSII_DEPRECATED = "quiet";

// Prevent CDK stack warnings about missing env vars during synthesis
process.env.MASTODON_ACCESS_TOKEN = "test-token";
process.env.BETTER_AUTH_SECRET = "test-secret-for-cdk-synthesis";

// Prevent better-auth DynamoDB adapter from throwing on module import
process.env.CONTENT_TABLE_NAME = "test-content-table";
process.env.SAMS_TABLE_NAME = "test-sams-table";
