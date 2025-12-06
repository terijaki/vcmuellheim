import { BadgeEuro, Building2, Bus, CalendarDays, Contact, MapPinned, Newspaper, UserCog, Users } from "lucide-react";
import type { ReactElement } from "react";
import type { FileRouteTypes } from "../routeTree.gen";

type DashboardRoute = [{ to: FileRouteTypes["to"]; label: string; icon: ReactElement; description: string; image: string }];
/** Array of dashboard routes with their labels and icons
 * @example [{ to: "/dashboard/news", label: "News", icon: <Newspaper />, description: "Lorem ipsum..." }],
 */
export function getDashboardRoutesWithLabels(admin = false): DashboardRoute[] {
	const routes: DashboardRoute[] = [
		[
			{
				to: "/dashboard/news",
				label: "News",
				icon: <Newspaper />,
				description: "Erstelle und verwalte Neuigkeiten und Ankündigungen.",
				image: "https://images.pexels.com/photos/2766006/pexels-photo-2766006.jpeg",
			},
		],
		[
			{
				to: "/dashboard/events",
				label: "Termine",
				icon: <CalendarDays />,
				description: "Erstelle Veranstaltungen, Turniere und sonstige Vereinsaktivitäten. SAMS Termine werden hier nicht angezeigt, da sie direkt vom SAMS Server geladen werden.",
				image: "https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg",
			},
		],
		[
			{
				to: "/dashboard/teams",
				label: "Mannschaften",
				icon: <Users />,
				description: "Informationen zu den Mannschaften, wie Trainingszeiten, Trainer, Mindestalter, Fotos.",
				image: "https://images.pexels.com/photos/9091935/pexels-photo-9091935.jpeg",
			},
		],
		[
			{
				to: "/dashboard/members",
				label: "Mitglieder",
				icon: <Contact />,
				description: "Verwalte die Mitglieder die Auf der Startseite angezeigt werden. Vorstand, Trainer und weitere Funktionäre.",
				image: "https://images.pexels.com/photos/8941612/pexels-photo-8941612.jpeg",
			},
		],
		[
			{
				to: "/dashboard/locations",
				label: "Orte",
				icon: <MapPinned />,
				description: "Feste Orte wie unsere Sporthallen, die bei Trainingszeiten der Mannschaften ausgewählt werden können.",
				image: "https://images.pexels.com/photos/7513413/pexels-photo-7513413.jpeg",
			},
		],
		[
			{
				to: "/dashboard/sponsors",
				label: "Sponsoren",
				icon: <BadgeEuro />,
				description: "Stelle Sponsoren ein mit Logo, Beschreibung und Link zur Webseite des Sponsors.",
				image: "https://images.pexels.com/photos/45708/pexels-photo-45708.jpeg",
			},
		],
		[
			{
				to: "/dashboard/bus",
				label: "Bus Buchungen",
				icon: <Bus />,
				description: "Trage Buchungen ein, um die Verfügbarkeit des Vereinsbusses zu verwalten.",
				image: "https://images.pexels.com/photos/27745430/pexels-photo-27745430.jpeg",
			},
		],
		[
			{
				to: "/dashboard/sams",
				label: "SAMS",
				icon: <Building2 />,
				description: "Dieser Bereich zeigt unsere SAMS Teams an, die wir zwischengespeichert haben.",
				image: "https://images.pexels.com/photos/1552620/pexels-photo-1552620.jpeg",
			},
		],
	];

	if (admin) {
		routes.splice(7, 0, [
			{
				to: "/dashboard/users",
				label: "Benutzer",
				icon: <UserCog />,
				description: "Die Benutzerverwaltung ermöglicht es, Benutzerkonten zu erstellen, zu bearbeiten, welche Zugriff auf dieses CMS haben.",
				image: "https://images.pexels.com/photos/5473956/pexels-photo-5473956.jpeg",
			},
		]);
	}

	return routes;
}
