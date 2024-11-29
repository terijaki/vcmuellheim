import "@/app/globals.css";
import Header from "@/app/components/layout/Header";
import Footer from "@/app/components/layout/Footer";
import type { Metadata } from "next";
import type { Viewport } from "next";
import { env } from "process";

export const viewport: Viewport = {
	themeColor: "#363b40", // onyx
	colorScheme: "light",
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
};
export const metadata: Metadata = {
	metadataBase: new URL("https://" + env.BASE_URL),
	title: {
		template: "VCM: %s",
		default: "Volleyballclub Müllheim",
	},
	description: "In Müllheim geht es in Sachen Volleyball richtig ab! Von Freizeit Team bis zur Amateurliga. Hier findest du alle Infos und Neuigkeiten des Vereins.",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="de">
			<body
				className="min-h-screen grid grid-rows-[max-content_1fr_max-content] grid-cols-main-grid overflow-y-scroll overflow-x-hidden bg-aquahaze text-black font-geohumanist cursor-default *:col-full-content *:w-full"
				data-build-time={Date.now()}
			>
				<Header />
				<main className="col-full-content grid grid-cols-main-grid auto-rows-max">{children}</main>
				<Footer />
			</body>
		</html>
	);
}
