import { createTheme, type MantineColorsTuple } from "@mantine/core";

const blumine: MantineColorsTuple = ["#f2f2f3", "#d4dadc", "#b2c3c9", "#8dadba", "#6599ad", "#498095", "#366273", "#284651", "#1a292f", "#0a0e10"];
const turquoise: MantineColorsTuple = ["#f1f4f4", "#cde2e1", "#9ddcd9", "#63e0da", "#22ece2", "#07d2c8", "#01a29a", "#04726c", "#07403d", "#051414"];
const onyx: MantineColorsTuple = ["#f2f2f2", "#d3d4d5", "#b2b5b8", "#91979d", "#6f7881", "#525a61", "#363b40", "#282c2f", "#1a1c1e", "#0c0d0d"];
const lion: MantineColorsTuple = ["#f3f2f2", "#e7e5e2", "#ddd7d1", "#d5c9be", "#cebcab", "#c7ae97", "#bfa084", "#916e4e", "#4e3e2f", "#0f0d0a"];
const aquahaze: MantineColorsTuple = ["#f2f3f3", "#f1f3f3", "#f1f4f4", "#f0f4f4", "#f0f5f5", "#eff5f5", "#eff5f5", "#92b9b9", "#496a6a", "#0b0f0f"];
const gamboge: MantineColorsTuple = ["#f4f3f1", "#e8e2d8", "#e3d3b9", "#e4c593", "#e9b86a", "#eeab41", "#f09e1a", "#aa6f0f", "#5a3d10", "#130e06"];

export const theme = createTheme({
	colors: { blumine, turquoise, onyx, lion, aquahaze, gamboge },
	primaryShade: 6,
	primaryColor: "blumine",
	fontFamily: "Avenir, Montserrat, Corbel, URW Gothic, source-sans-pro, system-ui, sans-serif",
	components: {
		Anchor: {
			defaultProps: {
				c: "turquoise",
			},
		},
		Loader: {
			defaultProps: {
				type: "dots",
				size: "lg",
			},
		},
		Skeleton: {
			defaultProps: {
				radius: "md",
			},
		},
	},
});
