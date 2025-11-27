import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import { ColorSchemeScript, colorsTuple, createTheme, MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "dayjs/locale/de";
import { AuthProvider } from "./auth/AuthContext";
import { TRPCProvider } from "./lib/TrpcProvider";
import { router } from "./router";

const theme = createTheme({
	colors: {
		blumine: colorsTuple("#366273"),
		turquoise: colorsTuple("#01a29a"),
		onyx: colorsTuple("#363b40"),
		lion: colorsTuple("#bfa084"),
		aquahaze: colorsTuple("#eff5f5"),
		gamboge: colorsTuple("#f09e1a"),
	},
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
	},
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
	<StrictMode>
		<AuthProvider>
			<TRPCProvider>
				<ColorSchemeScript defaultColorScheme="auto" />
				<MantineProvider theme={theme} defaultColorScheme="auto">
					<Notifications position="top-right" />
					<DatesProvider settings={{ locale: "de" }}>
						<RouterProvider router={router} />
					</DatesProvider>
				</MantineProvider>
			</TRPCProvider>
		</AuthProvider>
	</StrictMode>,
);
