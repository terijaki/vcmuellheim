/** Same-origin club logo path cached by CloudFront (`/api/sams/logos`). */
export function clubLogoProxyUrl(id: { clubUuid: string } | { clubSlug: string }): string {
  if ("clubUuid" in id) {
    return `/api/sams/logos?clubUuid=${encodeURIComponent(id.clubUuid)}`;
  }
  return `/api/sams/logos?clubSlug=${encodeURIComponent(id.clubSlug)}`;
}
