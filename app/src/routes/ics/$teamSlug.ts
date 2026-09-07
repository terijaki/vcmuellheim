/**
 * ICS calendar API route — /ics/$teamSlug
 *
 * Returns an iCalendar (.ics) file combining SAMS match data and custom DynamoDB events.
 * teamSlug can be "all", "home", or a specific team slug (e.g. "herren1").
 * The .ics file extension is stripped automatically.
 */

import type { LeagueMatch } from "@/lambda/sams/types";
import { loadScheduleMatchesForSamsTeamUuids } from "@webapp/server/functions/sams.server";
import { Club } from "@project.config";
import { createFileRoute } from "@tanstack/react-router";
import { filterHomeMatches } from "@/utils/sams-match-filter";
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
  match: LeagueMatch,
  teamLeagueName: string | undefined,
  timestamp: Date,
): IcsEvent | null {
  if (!match.date || !match.time) return null;
  const startTime = dayjs
    .tz(`${match.date} ${match.time}`, "YYYY-MM-DD HH:mm", "Europe/Berlin")
    .utc();
  if (!startTime.isValid()) return null;

  const homeTeam = match.team1.name;
  const guestTeam = match.team2.name;

  const locationParts: string[] = [];
  if (match.location?.name) locationParts.push(match.location.name);

  const baseDesc = [
    teamLeagueName,
    homeTeam ? `Heim: ${homeTeam}` : null,
    guestTeam ? `Gast: ${guestTeam}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const score = match.result?.setPoints;
  const description = score ? `Ergebnis: ${score}, ${baseDesc}` : baseDesc;

  return {
    start: { date: startTime.toDate(), type: "DATE-TIME" },
    duration: { hours: 3 },
    stamp: { date: timestamp, type: "DATE-TIME" },
    uid: match.uuid,
    summary: `${match.team1.name} vs ${match.team2.name}`,
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

          const isClubWideCalendar = !teamSlug || teamSlug === "all" || teamSlug === "home";
          const homeGamesOnly = teamSlug === "home";

          if (isClubWideCalendar) {
            calendarTitle = homeGamesOnly
              ? `${calendarTitle} - Heimspiele`
              : `${calendarTitle} - Vereinskalender`;
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
          const matches = await loadScheduleMatchesForSamsTeamUuids(teamSamsUuids);
          const scopedMatches = homeGamesOnly
            ? filterHomeMatches(matches, new Set(teamSamsUuids))
            : matches;
          const matchEvents = scopedMatches
            .map((match) => convertMatchToIcs(match, teamLeagueName, timestamp))
            .filter((e): e is IcsEvent => e !== null);

          // Home-games calendar is match-only; keep club/team event feeds on all/team calendars.
          const customEvents = homeGamesOnly ? [] : await fetchCustomEvents(teamId);
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
