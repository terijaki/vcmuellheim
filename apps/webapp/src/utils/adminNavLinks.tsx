import { BadgeEuro, Building2, Bus, CalendarDays, Contact, MapPinned, Newspaper, UserCog, Users } from "lucide-react";
import type { ReactElement } from "react";

type AdminRoute = {
	to: string;
	label: string;
	icon: ReactElement;
	description: string;
	image: string;
};

export function getAdminRoutesWithLabels(admin = false): AdminRoute[] {
	const routes: AdminRoute[] = [
		{
			to: "/admin/dashboard/news",
			label: "News",
			icon: <Newspaper />,
			description: "Erstelle und verwalte Neuigkeiten und Ankündigungen.",
			image: "https://images.pexels.com/photos/2766006/pexels-photo-2766006.jpeg",
		},
		{
			to: "/admin/dashboard/events",
			label: "Termine",
			icon: <CalendarDays />,
			description: "Erstelle Veranstaltungen, Turniere und sonstige Vereinsaktivitäten.",
			image: "https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg",
		},
		{
			to: "/admin/dashboard/teams",
			label: "Mannschaften",
			icon: <Users />,
			description: "Informationen zu den Mannschaften, wie Trainingszeiten, Trainer, Mindestalter, Fotos.",
			image: "https://images.pexels.com/photos/9091935/pexels-photo-9091935.jpeg",
		},
		{
			to: "/admin/dashboard/members",
			label: "Mitglieder",
			icon: <Contact />,
			description: "Verwalte die Mitglieder die Auf der Startseite angezeigt werden.",
			image: "https://images.pexels.com/photos/8941612/pexels-photo-8941612.jpeg",
		},
		{
			to: "/admin/dashboard/locations",
			label: "Orte",
			icon: <MapPinned />,
			description: "Feste Orte wie unsere Sporthallen.",
			image: "https://images.pexels.com/photos/7513413/pexels-photo-7513413.jpeg",
		},
		{
			to: "/admin/dashboard/sponsors",
			label: "Sponsoren",
			icon: <BadgeEuro />,
			description: "Stelle Sponsoren ein mit Logo, Beschreibung und Link.",
			image: "https://images.pexels.com/photos/45708/pexels-photo-45708.jpeg",
		},
		{
			to: "/admin/dashboard/bus",
			label: "Bus Buchungen",
			icon: <Bus />,
			description: "Trage Buchungen für den Vereinsbus ein.",
			image: "https://images.pexels.com/photos/27745430/pexels-photo-27745430.jpeg",
		},
		{
			to: "/admin/dashboard/sams",
			label: "SAMS",
			icon: <Building2 />,
			description: "SAMS Teams Übersicht.",
			image: "https://images.pexels.com/photos/1552620/pexels-photo-1552620.jpeg",
		},
	];

	if (admin) {
		routes.splice(7, 0, {
			to: "/admin/dashboard/users",
			label: "Benutzer",
			icon: <UserCog />,
			description: "Benutzerverwaltung für den CMS-Zugang.",
			image: "https://images.pexels.com/photos/5473956/pexels-photo-5473956.jpeg",
		});
	}

	return routes;
}
