/**
 * ICS calendar API route — /ics/$teamSlug
 *
 * Returns an iCalendar (.ics) file combining SAMS match data and custom DynamoDB events.
 * teamSlug can be "all" or a specific team slug (e.g. "herren1").
 * The .ics file extension is stripped automatically.
 */

import { getAllLeagueMatches, type LeagueMatchDto } from "@codegen/sams/generated";
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

async function fetchCustomEvents(teamId?: string): Promise<Event[]> {
  const fourteenDaysAgo = dayjs().subtract(14, "day").toISOString();
  const query = db().event.query.byType({ type: "event" }).gte({ startDate: fourteenDaysAgo });
  const result = await (teamId
    ? query.where((attr, op) => op.contains(attr.teamIds, teamId)).go({ pages: "all" })
    : query.go({ pages: "all" }));
  return result.data.map((item) => eventSchema.parse(item));
}

async function fetchMatchesForTeam(teamUuid: string): Promise<LeagueMatchDto[]> {
  const allMatches: LeagueMatchDto[] = [];
  let currentPage = 0;
  let hasMorePages = true;

  while (hasMorePages) {
    const { data } = await getAllLeagueMatches({
      query: {
        "for-team": teamUuid,
        page: currentPage,
        size: 100,
      },
    });

    if (!data) break;
    if (data.content) {
      allMatches.push(...data.content);
      currentPage++;
    }
    if (data.last === true) hasMorePages = false;
  }

  return allMatches;
}

async function fetchAllLeagueMatches(teamUuids: string[]): Promise<LeagueMatchDto[]> {
  const perTeam = await Promise.all(teamUuids.map((uuid) => fetchMatchesForTeam(uuid)));
  const seen = new Set<string>();
  const deduped: LeagueMatchDto[] = [];
  for (const matches of perTeam) {
    for (const match of matches) {
      if (match.uuid && !seen.has(match.uuid)) {
        seen.add(match.uuid);
        deduped.push(match);
      }
    }
  }
  return deduped;
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

function convertMatchToIcs(
  match: LeagueMatchDto,
  teamLeagueName: string | undefined,
  timestamp: Date,
): IcsEvent | null {
  if (!match.date || !match.time) return null;
  const startTime = dayjs
    .tz(`${match.date} ${match.time}`, "YYYY-MM-DD HH:mm", "Europe/Berlin")
    .utc();
  if (!startTime.isValid()) return null;

  const team1 = match._embedded?.team1;
  const team2 = match._embedded?.team2;
  const homeTeam = [team1, team2].find((t) => t?.uuid === match.host)?.name;
  const guestTeam = [team1, team2].find((t) => t?.uuid !== match.host)?.name;

  const locationParts: string[] = [];
  if (match.location?.name) locationParts.push(match.location.name);
  if (match.location?.address?.street) locationParts.push(match.location.address.street);
  const postalCity = [match.location?.address?.postcode, match.location?.address?.city]
    .filter(Boolean)
    .join(" ");
  if (postalCity) locationParts.push(postalCity);

  const baseDesc = [
    teamLeagueName,
    homeTeam ? `Heim: ${homeTeam}` : null,
    guestTeam ? `Gast: ${guestTeam}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const score = match.results?.setPoints;
  const description = score ? `Ergebnis: ${score}, ${baseDesc}` : baseDesc;

  return {
    start: { date: startTime.toDate(), type: "DATE-TIME" },
    duration: { hours: 3 },
    stamp: { date: timestamp, type: "DATE-TIME" },
    uid: match.uuid,
    summary: `${team1?.name} vs ${team2?.name}`,
    description,
    location: locationParts.join(", "),
  };
}

export const Route = createFileRoute("/ics/$teamSlug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const teamSlug = (params.teamSlug || "all").replace(/\.ics$/i, "").toLowerCase();

          let teamSamsUuids: string[] = [];
          let teamId: string | undefined;
          let teamLeagueName: string | undefined;
          let calendarTitle: string = Club.shortName;

          if (!teamSlug || teamSlug === "all") {
            calendarTitle = `${calendarTitle} - Vereinskalender`;
            const allTeamsResult = await db()
              .team.query.byType({ type: "team" })
              .go({ pages: "all" });
            teamSamsUuids = allTeamsResult.data
              .map((t) => teamSchema.parse(t).sbvvTeamId)
              .filter((id): id is string => !!id);
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
            if (foundTeam.sbvvTeamId) teamSamsUuids = [foundTeam.sbvvTeamId];
            teamId = foundTeam.id;
          }

          const timestamp = new Date();
          const matches = await fetchAllLeagueMatches(teamSamsUuids);
          const matchEvents = matches
            .map((match) => convertMatchToIcs(match, teamLeagueName, timestamp))
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
    },
  },
});
