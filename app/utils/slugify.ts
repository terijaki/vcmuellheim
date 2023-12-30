export function slugify(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[\W_]+/g, "") //spaces
		.replace(/^-+|-+$/g, "");
}
