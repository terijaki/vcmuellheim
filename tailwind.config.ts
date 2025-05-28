import type { Config } from "tailwindcss";

const config: Config = {
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			colors: {
				transparent: "transparent",
				current: "currentColor",
				blumine: "#366273",
				turquoise: "#01a29a",
				onyx: "#363b40",
				aquahaze: "#eff5f5",
				lion: "#bfa084",
				gamboge: "#f09e1a",
			},
			gridTemplateColumns: {
				"main-grid":
					"[full-content-start]  minmax(var(--page-x-space), 1fr) [center-content-start]var(--page-grid-content-area) [center-content-end] minmax(var(--page-x-space), 1fr) [full-content-end]", // the main grid which header, content and footer is applied to. this also serves as the grid for any subgrid elements
			},
			gridTemplateRows: {
				"news-card":
					"[top-start thumbnail-start] min(1px, 15rem) [heading-start] auto [thumbnail-end heading-end excerpt-start] 1fr [excerpt-end top-end]", // design for the news card to adjust dynamically depending on whether a thumbnail is present.
			},
			gridColumn: {
				"full-content": "full-content", // palces the element to take up the maximum body width
				"center-content": "center-content", // palces the element in the center of the main-grid and leaves a minspace left and right
			},
			fontFamily: {
				systemui: ["system-ui", "sans-serif"],
				transitional: ["Charter", "Bitstream Charter", "Sitka Text", "Cambria", "serif"],
				oldstyle: ["Iowan Old Style", "Palatino Linotype", "URW Palladio L", "P052", "serif"],
				humanist: ["Seravek", "Gill Sans Nova", "Ubuntu", "Calibri", "DejaVu Sans", "source-sans-pro", "sans-serif"],
				geohumanist: ["Avenir", "Montserrat", "Corbel", "URW Gothic", "source-sans-pro", "sans-serif"],
				classhuman: ["Optima", "Candara", "Noto Sans", "source-sans-pro", "sans-serif"],
				neogrote: ["Inter", "Roboto", "Helvetica Neue", "Arial Nova", "Nimbus Sans", "Arial", "sans-serif"],
				monoslab: ["Nimbus Mono PS", "Courier New", "monospace"],
				monocode: [
					"ui-monospace",
					"Cascadia Code",
					"Source Code Pro",
					"Menlo",
					"Consolas",
					"DejaVu Sans Mono",
					"monospace",
				],
				industrial: [
					"Bahnschrift",
					"DIN Alternate",
					"Franklin Gothic Medium",
					"Nimbus Sans Narrow",
					"sans-serif-condensed",
					"sans-serif",
				],
				roundsans: [
					"ui-rounded",
					"Hiragino Maru Gothic ProN",
					"Quicksand",
					"Comfortaa",
					"Manjari",
					"Arial Rounded MT",
					"Arial Rounded MT Bold",
					"Calibri",
					"source-sans-pro",
					"sans-serif",
				],
				slabserif: ["Rockwell", "Rockwell Nova", "Roboto Slab", "DejaVu Serif", "Sitka Small", "serif"],
				antique: [
					"Superclarendon",
					"Bookman Old Style",
					"URW Bookman",
					"URW Bookman L",
					"Georgia Pro",
					"Georgia",
					"serif",
				],
				didone: ["Didot", "Bodoni MT", "Noto Serif Display", "URW Palladio L", "P052", "Sylfaen", "serif"],
				handwritten: ["Segoe Print", "Bradley Hand", "Chilanka", "TSCu_Comic", "casual", "cursive"],
			},
		},
	},
	plugins: [require("@tailwindcss/typography"), ],
};

export default config;
