import {
  formatSamsMatchLocationLine,
  type SamsMatchLocationParts,
} from "./format-sams-match-location";

/**
 * Apple/Google maps search URL for a venue address.
 * Uses the same address line composition as ICS LOCATION / MapsLink.
 */
export function buildMapsSearchUrl(
  location: SamsMatchLocationParts,
  platform: "apple" | "google",
): string {
  const addressString = formatSamsMatchLocationLine(location);
  if (platform === "apple") {
    return `https://maps.apple.com/?q=${encodeURIComponent(addressString)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressString)}`;
}
