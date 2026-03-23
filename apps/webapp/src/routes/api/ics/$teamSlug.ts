/**
 * ICS calendar API route — /api/ics/$teamSlug
 *
 * Returns an iCalendar (.ics) file combining SAMS match data and custom DynamoDB events.
 * teamSlug can be "all" or a specific team slug (e.g. "herren1").
 * The .ics file extension is stripped automatically.
 */

import { Club } from "@project.config";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { generateIcsCalendar, type IcsCalendar, type IcsEvent } from "ts-ics";
import { db } from "@/lib/db/electrodb-client";
import { eventSchema, teamSchema } from "@/lib/db/schemas";
import type { Event } from "@/lib/db/types";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const SAMS_API_URL = process.env.SAMS_API_URL || "https://www.volleyball-baden.de/api/v2";

async function fetchCustomEvents(teamId?: string): Promise<Event[]> {
	const fourteenDaysAgo = dayjs().subtract(14, "day").toISOString();
	const query = db().event.query.byType({ type: "event" }).gte({ startDate: fourteenDaysAgo });
	const result = await (teamId ? query.where((attr, op) => op.contains(attr.teamIds, teamId)).go({ pages: "all" }) : query.go({ pages: "all" }));
	return result.data.map((item) => eventSchema.parse(item));
}

function convertEventToIcs(event: Event, timestamp: Date): IcsEvent {
	const startTime = dayjs(event.startDate);
	const endTime = event.endDate ? dayjs(event.endDate) : undefined;
	let duration: { hours: number; minutes?: number } | { minutes: number } = { hours: 2 };
	if (endTime?.isValid()) {
		const durationMinutes = endTime.diff(startTime, "minute");
		if (durationMinutes > 0) {
			if (durationMinutes >= 60) {
				const hours = Math.floor(durationMinutes / 60);
				const remainingMinutes = durationMinutes % 60;
				duration = remainingMinutes > 0 ? { hours, minutes: remainingMinutes } : { hours };
			} else {
				duration = { minutes: durationMinutes };
			}
		}
	}
	return {
		start: { date: startTime.toDate(), type: "DATE-TIME" },
		duration,
		stamp: { date: timestamp, type: "DATE-TIME" },
		uid: event.id,
		summary: event.title,
		description: event.description || "",
		location: event.location || "",
	};
}

export const Route = createFileRoute("/api/ics/$teamSlug")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				try {
					const teamSlug = (params.teamSlug || "all").replace(/\.ics$/i, "").toLowerCase();

					let teamSamsUuid: string | undefined;
					let teamId: string | undefined;
					let teamLeagueName: string | undefined;
					let calendarTitle: string = Club.shortName;

					if (!teamSlug || teamSlug === "all") {
						calendarTitle = `${calendarTitle} - Vereinskalender`;
					} else {
						const teamResult = await db().team.query.bySlug({ slug: teamSlug }).go({ limit: 1 });
						const foundTeam = teamResult.data[0] ? teamSchema.parse(teamResult.data[0]) : null;
						if (!foundTeam) {
							return new Response("Team nicht gefunden", {
								status: 404,
								headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
							});
						}
						if (foundTeam.name) calendarTitle = `${calendarTitle} - ${foundTeam.name}`;
						if (foundTeam.league) teamLeagueName = foundTeam.league;
						teamSamsUuid = foundTeam.sbvvTeamId;
						teamId = foundTeam.id;
					}

					const queryString = teamSamsUuid ? `?team=${teamSamsUuid}` : "";
					const response = await fetch(`${SAMS_API_URL}/matches${queryString}`);
					if (!response.ok) throw new Error(`Failed to fetch matches: ${response.statusText}`);
					const data = (await response.json()) as { matches?: unknown[]; timestamp?: string };
					const matches = (data.matches || []) as Array<{
						uuid: string;
						date: string;
						time: string;
						host?: string;
						_embedded?: { team1?: { uuid: string; name: string }; team2?: { uuid: string; name: string } };
						location?: { name?: string; address?: { street?: string; postcode?: string; city?: string } };
						results?: { setPoints?: string };
					}>;
					const timestamp = new Date(data.timestamp || new Date());

					const matchEvents: Array<IcsEvent | null> = matches.map((match) => {
						const startTime = dayjs.tz(`${match.date} ${match.time}`, "YYYY-MM-DD HH:mm", "Europe/Berlin").utc();
						if (!startTime.isValid()) return null;

						const team1 = match._embedded?.team1;
						const team2 = match._embedded?.team2;
						const homeTeam = [team1, team2].find((t) => t?.uuid === match.host)?.name;
						const guestTeam = [team1, team2].find((t) => t?.uuid !== match.host)?.name;

						const locationParts: string[] = [];
						if (match.location?.name) locationParts.push(match.location.name);
						if (match.location?.address?.street) locationParts.push(match.location.address.street);
						const postalCity = [match.location?.address?.postcode, match.location?.address?.city].filter(Boolean).join(" ");
						if (postalCity) locationParts.push(postalCity);

						const baseDesc = [teamLeagueName, homeTeam ? `Heim: ${homeTeam}` : null, guestTeam ? `Gast: ${guestTeam}` : null].filter(Boolean).join(", ");
						const score = match.results?.setPoints;
						const description = score ? `Ergebnis: ${score}, ${baseDesc}` : baseDesc;

						const icsEvent: IcsEvent = {
							start: { date: startTime.toDate(), type: "DATE-TIME" },
							duration: { hours: 3 },
							stamp: { date: timestamp, type: "DATE-TIME" },
							uid: match.uuid,
							summary: `${team1?.name} vs ${team2?.name}`,
							description,
							location: locationParts.join(", "),
						};

						return icsEvent;
					});

					const filteredMatchEvents = matchEvents.filter((event): event is IcsEvent => event !== null);

					const customEvents = await fetchCustomEvents(teamId);
					const customIcsEvents = customEvents.map((evt) => convertEventToIcs(evt, timestamp));

					const icsCalendar: IcsCalendar = {
						prodId: Club.shortName,
						version: "2.0",
						events: [...filteredMatchEvents, ...customIcsEvents],
						name: calendarTitle,
					};

					return new Response(generateIcsCalendar(icsCalendar), {
						status: 200,
						headers: {
							"Content-Type": "text/calendar; charset=utf-8",
							"Content-Disposition": `attachment; filename="${teamSlug || "all"}.ics"`,
							"Cache-Control": "public, max-age=1800, s-maxage=1800",
						},
					});
				} catch (error) {
					console.error("Error generating calendar:", error);
					return new Response("Es gab ein Problem beim Erzeugen des Kalenders", {
						status: 500,
						headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
					});
				}
			},
		},
	},
});
