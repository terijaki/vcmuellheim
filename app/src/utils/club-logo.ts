/** Same-origin club logo path cached by CloudFront (`/api/sams/logos`). */
export function clubLogoProxyUrl(clubUuid: string): string {
  return `/api/sams/logos?clubUuid=${encodeURIComponent(clubUuid)}`;
}

/** Same-origin team logo path cached by CloudFront (`/api/sams/team-logos`). */
export function teamLogoProxyUrl(teamUuid: string): string {
  return `/api/sams/team-logos?teamUuid=${encodeURIComponent(teamUuid)}`;
}
