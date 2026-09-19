export type SamsMatchLocationParts = {
  name?: string | null;
  street?: string | null;
  postal?: string | null;
  city?: string | null;
};

/**
 * Single-line venue address for ICS LOCATION and maps queries.
 * Matches the composition used in MapsLink (name, street, postal + city).
 */
export function formatSamsMatchLocationLine(location: SamsMatchLocationParts | undefined): string {
  if (!location) return "";

  const name = location.name?.trim();
  const street = location.street?.trim();
  const postal = location.postal?.trim();
  const city = location.city?.trim();

  let line = "";
  if (name) line += `${name}, `;
  if (street) line += street;
  if (street && (postal || city)) line += ", ";
  if (postal) line += postal;
  if (postal && city) line += " ";
  if (city) line += city;

  return line.trim().replace(/,\s*$/, "");
}
