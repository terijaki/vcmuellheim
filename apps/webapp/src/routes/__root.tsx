import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "../globals.css";
import { ColorSchemeScript, colorsTuple, createTheme, MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, ScrollRestoration, Scripts } from "@tanstack/react-router";
import dayjs from "dayjs";
import "dayjs/locale/de";
import type { RouterContext } from "../router";

dayjs.locale("de");

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
		Skeleton: {
			defaultProps: {
				radius: "md",
			},
		},
	},
});

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [{ charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" }, { name: "theme-color", content: "#366273" }],
		links: [{ rel: "icon", href: "/favicon.ico" }],
	}),
	component: RootDocument,
	errorComponent: ({ error }) => (
		<html lang="de">
			<head>
				<HeadContent />
			</head>
			<body>
				<div style={{ padding: "2rem", fontFamily: "system-ui" }}>
					<h1>Fehler</h1>
					<p>{(error as Error).message}</p>
				</div>
				<Scripts />
			</body>
		</html>
	),
	notFoundComponent: () => (
		<html lang="de">
			<head>
				<HeadContent />
			</head>
			<body>
				<div style={{ padding: "2rem", fontFamily: "system-ui" }}>
					<h1>404 – Seite nicht gefunden</h1>
				</div>
				<Scripts />
			</body>
		</html>
	),
});

function RootDocument() {
	const { queryClient } = Route.useRouteContext();

	return (
		<html lang="de">
			<head>
				<ColorSchemeScript />
				<HeadContent />
			</head>
			<body>
				<QueryClientProvider client={queryClient}>
					<MantineProvider theme={theme}>
						<DatesProvider settings={{ locale: "de", firstDayOfWeek: 1, consistentWeeks: true }}>
							<Notifications />
							<Outlet />
						</DatesProvider>
					</MantineProvider>
				</QueryClientProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}
