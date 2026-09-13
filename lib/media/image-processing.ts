import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { buildLambdaFunctionName } from "../construct/vcm-nodejs-function";

export type ProcessImagePayload = {
  bucket: string;
  key: string;
};

const MEDIA_FOLDER_PREFIXES = ["members/", "sponsors/", "teams/", "news/", "media/"] as const;

export function isAllowedMediaS3Key(s3Key: string): boolean {
  return MEDIA_FOLDER_PREFIXES.some((prefix) => s3Key.startsWith(prefix));
}

export function shouldProcessImageKey(key: string): boolean {
  const filename = key.split("/").pop() ?? "";

  if (/-\d{3,4}w\.\w+$/.test(filename)) {
    return false;
  }

  return /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
}

export function resolveImageProcessorFunctionName(): string | undefined {
  if (process.env.IMAGE_PROCESSOR_FUNCTION_NAME) {
    return process.env.IMAGE_PROCESSOR_FUNCTION_NAME;
  }

  if (process.env.CDK_ENVIRONMENT) {
    return buildLambdaFunctionName("bun-image-processor");
  }

  return undefined;
}

/** Invokes the image processor Lambda asynchronously (InvocationType: Event). */
export async function invokeImageProcessorAsync(
  bucket: string,
  s3Key: string,
  options?: { functionName?: string },
): Promise<void> {
  if (!shouldProcessImageKey(s3Key)) {
    return;
  }

  const functionName = options?.functionName ?? resolveImageProcessorFunctionName();
  if (!functionName) {
    console.warn(
      "IMAGE_PROCESSOR_FUNCTION_NAME is not configured — skipping image processing invoke",
    );
    return;
  }

  if (!isAllowedMediaS3Key(s3Key)) {
    throw new Error(`Invalid media S3 key: ${s3Key}`);
  }

  const client = new LambdaClient();
  const payload: ProcessImagePayload = { bucket, key: s3Key };
  const result = await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "Event",
      Payload: JSON.stringify(payload),
    }),
  );

  if (result.StatusCode !== 202) {
    throw new Error(`Image processor trigger failed: StatusCode=${result.StatusCode}`);
  }
}
