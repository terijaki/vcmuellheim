export function slugify(input: string, charactersOnly?: boolean): string {
	const base = input
		.trim()
		.toLowerCase()
		.replaceAll("ä", "ae") // Umlaut
		.replaceAll("ö", "oe") // Umlaut
		.replaceAll("ü", "ue") // Umlaut
		.replaceAll("ß", "ss") // Special letter
		.replaceAll(" ", "-") // Replace spaces with dashes
		.replaceAll(/^-+|-+$/g, ""); // starting/ending Dashes

	if (charactersOnly) {
		return base.replaceAll(/[\W_]+/g, ""); // any non-word character!! spaces, dashes, anything not a-Z, 0-9
	}
	return base;
}
