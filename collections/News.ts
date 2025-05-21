import { isModeratorOrAuthor, isOfficial } from "@/data/payload-access";
import type { CollectionConfig } from "payload";

type RichTextNode = {
	text?: string;
	children?: RichTextNode[];
};
// Helper function to extract plain text from rich text nodes
const extractTextFromRichText = (richText: RichTextNode[]): string => {
	if (!richText || !Array.isArray(richText)) return "";
	return richText
		.map((node) => {
			if (typeof node.text === "string") return node.text;
			if (node.children) return extractTextFromRichText(node.children);
			return "";
		})
		.join(" ")
		.replaceAll("  ", " ");
};

export const News: CollectionConfig = {
	slug: "news",
	labels: { plural: "News", singular: "News" },
	admin: {
		useAsTitle: "title",
		group: "Inhalte",
		defaultColumns: ["title", "excerpt", "publishedDate", "isPublished"],
		preview: ({ id }) => `/${News.slug}/${id}`,
	},
	access: {
		read: () => true,
		create: isOfficial,
		update: isModeratorOrAuthor,
		delete: isModeratorOrAuthor,
	},
	hooks: {
		beforeChange: [
			({ data }) => {
				// Generate excerpt from content if it exists
				if (data.content) {
					const plainText = extractTextFromRichText(data.content.root.children).trim();
					const excerpt = plainText.substring(0, 200); // (first ~200 characters)
					data.excerpt = excerpt.length < plainText.length ? `${excerpt}...` : excerpt; // elipsis if truncated
				}
				return data;
			},
		],
	},
	fields: [
		{
			name: "title",
			label: "Title",
			type: "text",
			required: true,
		},
		{
			name: "content",
			label: "Inhalt",
			type: "richText",
			required: true,
		},
		{
			name: "isPublished",
			label: "Veröffentlicht",
			type: "checkbox",
			defaultValue: true,
			admin: {
				position: "sidebar",
			},
		},
		{
			name: "publishedDate",
			label: "Veröffentlichungsdatum",
			type: "date",
			required: true,
			defaultValue: () => new Date().toISOString(),
			admin: {
				date: {
					displayFormat: "dd.MM.yyyy",
				},
				position: "sidebar",
			},
		},
		{
			name: "authors",
			label: "Autor(en)",
			type: "relationship",
			relationTo: "users",
			hasMany: true,
			defaultValue: ({ req: { user } }) => [user?.id],
			admin: {
				position: "sidebar",
			},
		},
		{
			name: "images",
			label: "Bilder",
			type: "upload",
			relationTo: "media",
			hasMany: true,
			admin: {
				position: "sidebar",
			},
		},
		{
			name: "excerpt",
			type: "text",
			admin: {
				description: "Automatisch generiert vom Inhalt",
				readOnly: true,
				hidden: true,
			},
		},
	],
};
