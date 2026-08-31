function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Deterministic SVG club mark (transparent background, works with mix-blend multiply). */
export function clubLogoDataUri(club: { initials: string; color: string }): string {
  const initials = escapeXml(club.initials);
  const color = escapeXml(club.color);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">` +
    `<circle cx="64" cy="64" r="54" fill="none" stroke="${color}" stroke-width="10"/>` +
    `<text x="64" y="76" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" ` +
    `font-size="36" font-weight="700" fill="${color}">${initials}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
