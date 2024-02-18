export function slugify(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace("ä", "ae") // Umlaut
		.replace("ö", "oe") // Umlaut
		.replace("ü", "ue") // Umlaut
		.replace("ß", "ss") // Special letter
		.replace(/[\W_]+/g, "") //spaces
		.replace(/^-+|-+$/g, "");
}
