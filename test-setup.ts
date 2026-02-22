// Suppress Powertools structured log output during tests
process.env.POWERTOOLS_LOG_LEVEL = "SILENT";

// Suppress jsii deprecation warnings from aws-cdk-lib
process.env.JSII_DEPRECATED = "quiet";

// Prevent CDK stack warnings about missing env vars during synthesis
process.env.MASTODON_ACCESS_TOKEN = "test-token";
