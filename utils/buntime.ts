/** Pinned Bun version for the Lambda custom runtime layer and CDK bundling images. */
export const BUN_VERSION = "1.4.0" as const;

/** Account-scoped SSM parameter holding the Bun Lambda runtime layer ARN. */
export const BUN_TIME_LAYER_SSM_NAME = "/vcmuellheim/lambda/buntime-arn" as const;

/** CDK bundling image. Local `tryBundle` must succeed so Docker is never started. */
export const BUN_DOCKER_IMAGE = `oven/bun:${BUN_VERSION}` as const;

/** Linux x64 Bun release zip used to build the Lambda layer (no Docker). */
export const BUN_LINUX_X64_RELEASE_URL =
  `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip` as const;
