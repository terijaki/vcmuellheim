/**
 * ICS calendar API route — /api/ics/$teamSlug
 *
 * Returns an iCalendar (.ics) file combining SAMS match data and custom DynamoDB events.
 * teamSlug can be "all" or a specific team slug (e.g. "herren1").
 * The .ics file extension is stripped automatically.
 */

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Club } from "@project.config";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { generateIcsCalendar, type IcsCalendar, type IcsEvent } from "ts-ics";
import { docClient, getTableName } from "@/lib/db/client";
import type { Event } from "@/lib/db/types";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const SAMS_API_URL = process.env.SAMS_API_URL || "https://www.volleyball-baden.de/api/v2";

async function fetchCustomEvents(teamId?: string): Promise<Event[]> {
	const fourteenDaysAgo = dayjs().subtract(14, "day").toISOString();
	const expressionAttributeValues: Record<string, unknown> = {
		":type": "event",
		":fourteenDaysAgo": fourteenDaysAgo,
	};
	let filterExpression: string | undefined;
	if (teamId) {
		filterExpression = "contains(teamIds, :teamId)";
		expressionAttributeValues[":teamId"] = teamId;
	}
	const result = await docClient.send(
		new QueryCommand({
			TableName: getTableName("EVENTS"),
			IndexName: "GSI-EventQueries",
			KeyConditionExpression: "#type = :type AND #startDate >= :fourteenDaysAgo",
			ExpressionAttributeNames: { "#type": "type", "#startDate": "startDate" },
			ExpressionAttributeValues: expressionAttributeValues,
			FilterExpression: filterExpression,
			ScanIndexForward: true,
		}),
	);
	return (result.Items as Event[]) || [];
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

export const APIRoute = createAPIFileRoute("/api/ics/$teamSlug")({
	GET: async ({ params }) => {
		try {
			const teamSlug = (params.teamSlug || "all").replace(/\.ics$/i, "").toLowerCase();

			let teamSamsUuid: string | undefined;
			let teamId: string | undefined;
			let teamLeagueName: string | undefined;
			let calendarTitle = Club.shortName;

			if (!teamSlug || teamSlug === "all") {
				calendarTitle = `${calendarTitle} - Vereinskalender`;
			} else {
				const result = await docClient.send(
					new QueryCommand({
						TableName: getTableName("TEAMS"),
						IndexName: "GSI-TeamQueries",
						KeyConditionExpression: "#type = :type AND #slug = :slug",
						ExpressionAttributeNames: { "#type": "type", "#slug": "slug" },
						ExpressionAttributeValues: { ":type": "team", ":slug": teamSlug },
						Limit: 1,
					}),
				);
				const foundTeam = result.Items?.[0];
				if (!foundTeam) {
					return new Response("Team nicht gefunden", {
						status: 404,
						headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
					});
				}
				if (foundTeam.name) calendarTitle = `${calendarTitle} - ${foundTeam.name}`;
				if (foundTeam.league) teamLeagueName = foundTeam.league as string;
				teamSamsUuid = foundTeam.sbvvTeamId as string | undefined;
				teamId = foundTeam.id as string;
			}

			// Fetch SAMS matches
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

			const matchEvents: IcsEvent[] = matches
				.map((match) => {
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

					return {
						start: { date: startTime.toDate(), type: "DATE-TIME" } as const,
						duration: { hours: 3 },
						stamp: { date: timestamp, type: "DATE-TIME" } as const,
						uid: match.uuid,
						summary: `${team1?.name} vs ${team2?.name}`,
						description,
						location: locationParts.join(", "),
					} satisfies IcsEvent;
				})
				.filter((e): e is IcsEvent => e !== null);

			const customEvents = await fetchCustomEvents(teamId);
			const customIcsEvents = customEvents.map((evt) => convertEventToIcs(evt, timestamp));

			const icsCalendar: IcsCalendar = {
				prodId: Club.shortName,
				version: "2.0",
				events: [...matchEvents, ...customIcsEvents],
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
});
