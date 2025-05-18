// "use cache";
// cacheLife("minutes");
// import { unstable_cacheLife as cacheLife } from "next/cache";
import { getTeams } from "@/app/utils/getTeams";
import { samsClubData, samsClubMatches, samsMatches } from "@/app/utils/sams/sams-server-actions";
import { Club } from "@/project.config";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { type NextRequest, NextResponse } from "next/server";
import { type IcsCalendar, type IcsEvent, generateIcsCalendar } from "ts-ics";
dayjs.extend(customParseFormat);

export async function GET(request: NextRequest, { params }: { params: Promise<{ team: string }> }) {
	try {
		const { team } = await params;
		const sanitisedTeam = team.replace(".ics", "").toLowerCase();

		let matches: Awaited<ReturnType<typeof samsMatches>> = [];
		let calendarTitle = Club.shortName;

		if (!sanitisedTeam || sanitisedTeam === "all") {
			// get all club matches - future and past matches
			matches = await samsClubMatches({});
			calendarTitle = `${calendarTitle} - Vereinskalender`;
		} else {
			// check if the team slug is valid
			const teams = await getTeams();
			const desiredTeam = teams.find((team) => team.slug === sanitisedTeam);
			const desiredSbvvId = desiredTeam?.sbvvId;
			// if the team has an sbvvId, get the matches for that team
			if (desiredSbvvId) {
				const clubData = await samsClubData();
				const allSeasonMatchSeriesId = clubData?.teams?.team?.find(
					(team) => team.id.toString() === desiredSbvvId.toString(),
				)?.matchSeries.allSeasonId;
				if (allSeasonMatchSeriesId) {
					matches = await samsMatches({ allSeasonMatchSeriesId });
					if (desiredTeam.title) calendarTitle = `${calendarTitle} - ${desiredTeam.title}`;
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
