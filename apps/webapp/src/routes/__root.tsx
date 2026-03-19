import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "../globals.css";
import { ColorSchemeScript, colorsTuple, createTheme, MantineProvider, mantineHtmlProps } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { Club } from "@project.config";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import dayjs from "dayjs";
import "dayjs/locale/de";
import type { RouterContext } from "../router";
import { getSessionFn } from "../server/functions/session";

dayjs.locale("de");

const DEFAULT_DESCRIPTION = "Willkommen beim Volleyballclub Müllheim e.V. - Dein Volleyballverein für alle Altersklassen mit Damen-, Herren- und Jugendteams.";
const DEFAULT_IMAGE = `${Club.url}/assets/logos/logo-366273-500.png`;

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
	beforeLoad: async () => {
		const session = await getSessionFn();
		return { session };
	},
	head: () => ({
		title: Club.name,
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ name: "theme-color", content: "#366273" },
			{ name: "description", content: DEFAULT_DESCRIPTION },
			{ name: "robots", content: "index, follow" },
			{ property: "og:type", content: "website" },
			{ property: "og:title", content: Club.name },
			{ property: "og:description", content: DEFAULT_DESCRIPTION },
			{ property: "og:image", content: DEFAULT_IMAGE },
			{ property: "og:url", content: Club.url },
			{ property: "og:site_name", content: Club.name },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: Club.name },
			{ name: "twitter:description", content: DEFAULT_DESCRIPTION },
			{ name: "twitter:image", content: DEFAULT_IMAGE },
		],
		links: [
			{ rel: "icon", href: "/favicon.ico" },
			{ rel: "canonical", href: Club.url },
		],
	}),
	component: RootDocument,
	errorComponent: ({ error }) => (
		<html lang="de" {...mantineHtmlProps}>
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
		<html lang="de" {...mantineHtmlProps}>
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
		<html lang="de" {...mantineHtmlProps}>
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
				<Scripts />
			</body>
		</html>
	);
}
