/**
 * Upload server-only helpers — S3 presigned URLs and media URL resolution.
 */

import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { invokeImageProcessorAsync } from "@/lib/media/image-processing";

const s3Client = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
const BUCKET_NAME = () => process.env.MEDIA_BUCKET_NAME || "";
const MEDIA_CLOUDFRONT_URL = () => process.env.MEDIA_CLOUDFRONT_URL || "";

export async function handleGetFileUrl(s3Key: string): Promise<string | null> {
  if (!s3Key) return null;
  const cfUrl = MEDIA_CLOUDFRONT_URL();
  if (cfUrl) return `${cfUrl}/${s3Key}`;
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME(), Key: s3Key });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function handleGetFileUrls(s3Keys: string[]): Promise<string[]> {
  const result: string[] = [];
  const cfUrl = MEDIA_CLOUDFRONT_URL();
  for (const s3Key of s3Keys) {
    if (cfUrl) {
      result.push(`${cfUrl}/${s3Key}`);
    } else {
      const command = new GetObjectCommand({ Bucket: BUCKET_NAME(), Key: s3Key });
      result.push(await getSignedUrl(s3Client, command, { expiresIn: 3600 }));
    }
  }
  return result;
}

export async function handleGetPresignedUrl(data: {
  filename: string;
  contentType: string;
  folder: "sponsors" | "teams" | "members" | "news" | "media";
}) {
  const fileExtension = data.filename.split(".").pop() || "";
  const sanitizedExtension = fileExtension.toLowerCase().replace(/[^a-z0-9]/g, "");
  const uuid = randomUUID();
  const finalKey = sanitizedExtension
    ? `${data.folder}/${uuid}.${sanitizedExtension}`
    : `${data.folder}/${uuid}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME(),
    Key: finalKey,
    ContentType: data.contentType,
  });

  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  return {
    uploadUrl: presignedUrl,
    key: finalKey,
    bucket: BUCKET_NAME(),
  };
}

export async function handleProcessMediaImage(s3Key: string): Promise<void> {
  const bucket = BUCKET_NAME();
  if (!bucket) {
    throw new Error("MEDIA_BUCKET_NAME is not configured");
  }

  await invokeImageProcessorAsync(bucket, s3Key);
}
