/**
 * Member proxy alias utilities:
 * - Alias suggestion via normalized name + domain
 * - German character normalization
 * - Dev branch suffix support (plus-addressing)
 */

/** Map of German special characters to ASCII equivalents */
const GERMAN_CHAR_MAP: Record<string, string> = {
	ä: "ae",
	ö: "oe",
	ü: "ue",
	Ä: "ae",
	Ö: "oe",
	Ü: "ue",
	ß: "ss",
};

/**
 * Normalize a member name into a proxy alias local part.
 *
 * Examples:
 *   "Max Müller"   → "max.mueller"
 *   "Björn Koß" → "bjoern.koss"
 *   "Anna-Lisa"    → "anna-lisa" (hyphens preserved as dots)
 */
export function normalizeAliasLocalPart(name: string): string {
	return name
		.split("")
		.map((ch) => GERMAN_CHAR_MAP[ch] ?? ch)
		.join("")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ".")
		.replace(/\.{2,}/g, ".")
		.replace(/^\.+|\.+$/g, "");
}

/**
 * Build the full suggested proxy email address for a member.
 *
 * In non-production environments a `branchName` can be supplied to add a
 * plus-address suffix so that multiple dev branch Lambdas do not
 * double-forward the same message.
 *
 * @param name       Member display name (e.g. "Max Müller")
 * @param domain     Recipient domain (e.g. "vcmuellheim.de")
 * @param branchName Optional sanitized branch name for dev environments
 */
export function normalizeProxyAlias(name: string, domain: string, branchName?: string): string {
	const localPart = normalizeAliasLocalPart(name);
	const suffix = branchName ? `+${branchName}` : "";
	return `${localPart}${suffix}@${domain}`;
}
