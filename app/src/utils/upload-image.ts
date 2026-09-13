import { getPresignedUrlFn, processMediaImageFn } from "@webapp/server/functions/upload";

export type MediaUploadFolder = "members" | "sponsors" | "teams" | "news" | "media";

export async function uploadImageFile(file: File, folder: MediaUploadFolder): Promise<string> {
  const { uploadUrl, key } = await getPresignedUrlFn({
    data: { filename: file.name, contentType: file.type, folder },
  });

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error("Datei-Upload fehlgeschlagen");
  }

  const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  if (!isSvg) {
    await processMediaImageFn({ data: { s3Key: key } });
  }

  return key;
}
