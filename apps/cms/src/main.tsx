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
import * as Sentry from "@sentry/react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { TrpcProvider } from "./lib/TrpcProvider";
import { router } from "./router";

// Initialize Sentry
Sentry.init({
	dsn: "https://fa39728bab836eac8258598505b891fe@o4509428230979584.ingest.de.sentry.io/4509428234322000",
	tracesSampleRate: 1,
	debug: false,
	environment: import.meta.env.VITE_CDK_ENVIRONMENT || "development",
	integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration(), Sentry.tanstackRouterBrowserTracingIntegration(router)],
	replaysSessionSampleRate: 0.1,
	replaysOnErrorSampleRate: 1.0,
});

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

function ThemingProvider({ children }: { children: React.ReactNode }) {
	return (
		<>
			<ColorSchemeScript defaultColorScheme="auto" />
			<MantineProvider theme={theme} defaultColorScheme="auto">
				<Notifications position="bottom-right" limit={2} />
				<DatesProvider settings={{ locale: "de" }}>{children}</DatesProvider>
			</MantineProvider>
		</>
	);
}

function ProtectedApp() {
	const auth = useAuth();
	return <RouterProvider router={router} context={{ auth }} />;
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
	<StrictMode>
		<ThemingProvider>
			<AuthProvider>
				<TrpcProvider>
					<ProtectedApp />
				</TrpcProvider>
			</AuthProvider>
		</ThemingProvider>
	</StrictMode>,
);
