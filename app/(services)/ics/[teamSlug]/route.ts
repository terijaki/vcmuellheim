"use cache";
import { getTeams } from "@/data/teams";
import { Club } from "@/project.config";
import { samsClubMatches, samsMatches } from "@/utils/sams/sams-server-actions";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { unstable_cacheLife as cacheLife } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { type IcsCalendar, type IcsEvent, generateIcsCalendar } from "ts-ics";
dayjs.extend(customParseFormat);

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamSlug: string }> }) {
	cacheLife("minutes");
	try {
		const { teamSlug } = await params;
		const sanitisedTeam = teamSlug.replace(".ics", "").toLowerCase();

		let matches: Awaited<ReturnType<typeof samsMatches>> = [];
		let calendarTitle = Club.shortName;

		if (!sanitisedTeam || sanitisedTeam === "all") {
			// get all club matches - future and past matches
			matches = await samsClubMatches({});
			calendarTitle = `${calendarTitle} - Vereinskalender`;
		} else {
			// check if the team slug is valid
			const teams = await getTeams(teamSlug);
			const team = teams?.docs?.[0];
			if (!team?.sbvvTeam || typeof team.sbvvTeam === "string") throw "Team not found";

			const samsTeam = team?.sbvvTeam;
			const sbvvId = samsTeam?.seasonTeamId;
			// if the team has an sbvvId, get the matches for that team
			if (sbvvId) {
				const allSeasonMatchSeriesId = team.sbvvTeam?.matchSeries_AllSeasonId;
				if (allSeasonMatchSeriesId) {
					matches = await samsMatches({ allSeasonMatchSeriesId });
					if (samsTeam.name) calendarTitle = `${calendarTitle} - ${samsTeam.name}`;
				}
			}
		}

		// Convert matches to iCalendar events
		const events = matches?.map((match) => {
			const startTime = dayjs(`${match.date} ${match.time}`, "DD.MM.YYYY HH:mm").toDate();
			const updatedTime = dayjs(match.matchSeries.resultsUpdated).toDate();

			const homeTeam = match.host.name;
			const guestTeam = match.team.filter((team) => team.uuid !== match.host.uuid)[0].name;
			const league = match.matchSeries.name;

			const location = [];
			if (match.location.name) location.push(match.location.name);
			if (match.location.street) location.push(match.location.street);
			if (match.location.postalCode || match.location.city) {
				// Merge postal code and city if they exist
				const postalAndCity = [];
				if (match.location.postalCode) postalAndCity.push(match.location.postalCode);
				if (match.location.city) postalAndCity.push(match.location.city);
				location.push(postalAndCity.join(" "));
			}

			const baseDescription = `${league}, Heim: ${homeTeam}, Gast: ${guestTeam}`;
			let description = baseDescription;
			const score = match.results?.setPoints;
			if (score) description = `Ergebnis: ${score}, ${baseDescription}`;

			const eventData: IcsEvent = {
				start: { date: startTime, type: "DATE-TIME" },
				duration: { hours: 3 },
				stamp: { date: updatedTime, type: "DATE-TIME" },
				uid: match.uuid,
				summary: `${match.team[0].name} vs ${match.team[1].name}`,
				description: description,
				location: location.join(", "),
			};

			return eventData;
		});

		const icsCalendar: IcsCalendar = {
			prodId: Club.shortName,
			version: "2.0",
			events: events,
			name: calendarTitle,
		};

		// Generate ICS content (aka the calendar file)
		const icsContent = generateIcsCalendar(icsCalendar);

		// Return the ICS file
		return new NextResponse(icsContent, {
			headers: {
				"Content-Type": "text/calendar; charset=utf-8",
				"Content-Disposition": 'attachment; filename="all.ics"',
			},
		});
	} catch (error) {
		console.error("Error generating calendar:", error);
		return new NextResponse("Es gab ein Problem beim erzeugen des Kalender", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
			},
		});
	}
}
