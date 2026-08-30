import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({});

/**
 * Downloads a logo from a URL and uploads it to S3.
 * Returns the S3 key on success, or undefined on failure (non-blocking).
 */
export async function uploadClubLogoToS3(
  bucketName: string,
  sportsclubUuid: string,
  logoUrl: string,
): Promise<string | undefined> {
  if (!bucketName) return undefined;

  try {
    const response = await fetch(logoUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "VCM ClubSync/1.0" },
    });
    if (!response.ok) {
      console.warn(`Logo fetch failed for ${sportsclubUuid}: HTTP ${response.status}`);
      return undefined;
    }
    const contentType = response.headers.get("content-type") ?? "image/png";
    const ext = contentType.includes("jpeg")
      ? "jpg"
      : contentType.includes("gif")
        ? "gif"
        : contentType.includes("webp")
          ? "webp"
          : "png";
    const s3Key = `sams-logos/${sportsclubUuid}.${ext}`;
    const body = Buffer.from(await response.arrayBuffer());
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=604800",
      }),
    );
    return s3Key;
  } catch (err) {
    console.warn(`Logo upload skipped for ${sportsclubUuid}:`, err);
    return undefined;
  }
}
