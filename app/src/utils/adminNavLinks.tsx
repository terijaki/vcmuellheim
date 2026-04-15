import { BadgeEuro, Building2, Bus, CalendarDays, Contact, HandHelping, MapPinned, Newspaper, Users } from "lucide-react";
import type { ReactElement } from "react";

type AdminRoute = {
	to: string;
	label: string;
	icon: ReactElement;
	description: string;
};

export function getAdminRoutesWithLabels(): AdminRoute[] {
	const routes: AdminRoute[] = [
		{
			to: "/admin/news",
			label: "News",
			icon: <Newspaper />,
			description: "Erstelle und verwalte Neuigkeiten und Ankündigungen.",
		},
		{
			to: "/admin/events",
			label: "Termine",
			icon: <CalendarDays />,
			description: "Erstelle Veranstaltungen, Turniere und sonstige Vereinsaktivitäten.",
		},
		{
			to: "/admin/teams",
			label: "Mannschaften",
			icon: <Users />,
			description: "Informationen zu den Mannschaften, wie Trainingszeiten, Trainer, Alter, Fotos.",
		},
		{
			to: "/admin/members",
			label: "Mitglieder",
			icon: <Contact />,
			description: "Verwalte die Mitglieder die Auf der Startseite angezeigt werden.",
		},
		{
			to: "/admin/locations",
			label: "Orte",
			icon: <MapPinned />,
			description: "Feste Orte wie unsere Sporthallen.",
		},
		{
			to: "/admin/sponsors",
			label: "Sponsoren",
			icon: <BadgeEuro />,
			description: "Stelle Sponsoren ein mit Logo, Beschreibung und Link.",
		},
		{
			to: "/admin/bus",
			label: "Bus Buchungen",
			icon: <Bus />,
			description: "Trage Buchungen für den Vereinsbus ein.",
		},
		{
			to: "/admin/sams",
			label: "SAMS",
			icon: <Building2 />,
			description: "SAMS Teams Übersicht.",
		},
		{
			to: "/admin/volunteerEvent",
			label: "Helfer",
			icon: <HandHelping />,
			description: "Erstelle und verwalte Helfereinsätze (z. B. Stadtfest).",
		},
	];

	return routes;
}
