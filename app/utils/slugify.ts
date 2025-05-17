export function slugify(input: string, charactersOnly?: boolean): string {
	if (charactersOnly) {
		return input
			.trim()
			.toLowerCase()
			.replaceAll("ä", "ae") // Umlaut
			.replaceAll("ö", "oe") // Umlaut
			.replaceAll("ü", "ue") // Umlaut
			.replaceAll("ß", "ss") // Special letter
			.replaceAll(/[\W_]+/g, ""); // any non-word character!! spaces, dashes, anything not a-Z, 0-9
	}
	return input
		.trim()
		.toLowerCase()
		.replaceAll("ä", "ae") // Umlaut
		.replaceAll("ö", "oe") // Umlaut
		.replaceAll("ü", "ue") // Umlaut
		.replaceAll("ß", "ss") // Special letter
		.replaceAll(/^-+|-+$/g, ""); // starting/ending Dashes
}
