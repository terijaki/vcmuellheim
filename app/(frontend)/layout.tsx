import DatesDEProvider from "@/components/DatesDEProvider";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import { Club } from "@/project.config";
import { AppShell, AppShellMain, MantineProvider, Stack, colorsTuple, createTheme } from "@mantine/core";
import "@mantine/core/styles.css";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
	themeColor: "#363b40", // onyx
	colorScheme: "light",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
};
export const metadata: Metadata = {
	metadataBase: new URL(`https://${Club.domain}`),
	title: {
		template: "VCM: %s",
		default: "Volleyballclub Müllheim",
	},
	description:
		"In Müllheim geh es in Sachen Volleyball richtig ab! Von Freizeit Team bis zur Amateurliga. Hier findest du alle Infos und Neuigkeiten des Vereins.",
	icons: {
		icon: "/images/icons/favicon.png",
		shortcut: "/images/icons/favicon.png",
		apple: "/images/icons/favicon.png",
		other: {
			rel: "apple-touch-icon-precomposed",
			url: "/images/icons/ball-512x512.png",
		},
	},
	openGraph: {
		title: "Volleyballclub Müllheim",
		url: "/",
		description: "",
		siteName: "Volleyballclub Müllheim",
		locale: "de_DE",
		type: "website",
	},
	robots: {
		index: true,
		follow: true,
		nocache: true,
		googleBot: {
			index: true,
			follow: true,
			noimageindex: true,
			"max-video-preview": -1,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
	},
	referrer: "same-origin",
};

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="de">
			<body data-build-time={Date.now()} style={{ cursor: "default" }}>
				<MantineProvider theme={theme}>
					<DatesDEProvider>
						<AppShell header={{ height: 60, offset: true }} withBorder={false} bg="aquahaze">
							<Header />

							<AppShellMain>
								<Stack justify="space-between" style={{ minHeight: "calc(100vh - 60px)" }}>
									{children}

									<Footer />
								</Stack>
							</AppShellMain>
						</AppShell>
					</DatesDEProvider>
				</MantineProvider>
			</body>
		</html>
	);
}
