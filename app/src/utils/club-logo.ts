/** Same-origin club logo path cached by CloudFront (`/api/sams/logos`). */
export function clubLogoProxyUrl(clubUuid: string): string {
  return `/api/sams/logos?clubUuid=${encodeURIComponent(clubUuid)}`;
}
