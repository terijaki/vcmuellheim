import { App } from "aws-cdk-lib";

/**
 * Creates a CDK App configured for unit tests.
 * Setting `aws:cdk:bundling-stacks` to an empty array disables esbuild bundling
 * during stack synthesis, which significantly speeds up CDK stack tests.
 */
export function createTestApp() {
	return new App({ context: { "aws:cdk:bundling-stacks": [] } });
}
