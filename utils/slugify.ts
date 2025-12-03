/** Slugifies a string by converting it to lowercase, replacing spaces with dashes, and trimming whitespace.
 * If `charactersOnly` is true, removes all non-alphanumeric characters.
 *
 * @param input - The input string to slugify.
 * @param charactersOnly - If true, removes all non-alphanumeric characters. e.g., "hello-world!" -> "helloworld"
 * @returns The slugified string.
 */
export function slugify(input: string, charactersOnly?: boolean): string {
	const base = input
		.trim()
		.toLowerCase()
		.replaceAll("ä", "ae") // Umlaut
		.replaceAll("ö", "oe") // Umlaut
		.replaceAll("ü", "ue") // Umlaut
		.replaceAll("ß", "ss") // Special letter
		.replaceAll(/\s+/g, "-") // Replace one or more spaces with single dash
		.replaceAll(/^-+|-+$/g, ""); // starting/ending Dashes

	if (charactersOnly) {
		return base.replaceAll(/[\W_]+/g, ""); // any non-word character!! spaces, dashes, anything not a-Z, 0-9
	}
	return base;
}
