import {
  BadgeEuro,
  Building2,
  Bus,
  CalendarDays,
  Contact,
  HandHelping,
  KeyRound,
  MapPinned,
  Newspaper,
  Users,
} from "lucide-react";
import type { ReactElement } from "react";

type AdminRoute = {
  to: string;
  label: string;
  icon: ReactElement;
  description: string;
  adminOnly?: boolean;
};

export function getAdminRoutesWithLabels(authRole?: string): AdminRoute[] {
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
      to: "/admin/volunteer-event",
      label: "Veranstaltung",
      icon: <HandHelping />,
      description:
        "Erstelle und verwalte ehrenamtliche Veranstaltungen mit Anmeldungen (z. B. Stadtfest).",
    },
    {
      to: "/admin/sams",
      label: "SAMS",
      icon: <Building2 />,
      description: "SAMS Teams Übersicht.",
    },
    {
      to: "/admin/api-keys",
      label: "API-Schlüssel",
      icon: <KeyRound />,
      description: "Erstelle und lösche Schlüssel für den programmatischen Zugriff.",
      adminOnly: true,
    },
  ];

  return routes.filter((route) => !route.adminOnly || authRole === "Admin");
}
