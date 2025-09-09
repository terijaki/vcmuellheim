import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { type NextRequest, NextResponse } from "next/server";
import { generateIcsCalendar, type IcsCalendar, type IcsEvent } from "ts-ics";
import { samsLeagueMatches } from "@/data/sams/sams-server-actions";
import { getTeams } from "@/data/teams";
import { Club } from "@/project.config";

dayjs.extend(customParseFormat);

export async function GET(_request: NextRequest, { params }: { params: Promise<{ teamSlug: string }> }) {
	try {
		const { teamSlug } = await params;
		const sanitisedTeamSlug = teamSlug.replace(".ics", "").toLowerCase();

		let teamSamsUuid: string | undefined;
		let teamLeagueName: string | undefined;

		let calendarTitle = Club.shortName;

		if (!sanitisedTeamSlug || sanitisedTeamSlug === "all") {
			// get all club matches - future and past matches
			calendarTitle = `${calendarTitle} - Vereinskalender`;
		} else {
			// check if the team slug is valid
			const teams = await getTeams(sanitisedTeamSlug);
			const team = teams?.docs?.[0];
			if (!team) throw "Team not found";
			if (team.name) calendarTitle = `${calendarTitle} - ${team.name}`;
			if (team.league) teamLeagueName = team.league;

			const samsTeam = typeof team.sbvvTeam === "object" ? team.sbvvTeam : undefined;
			teamSamsUuid = samsTeam?.uuid;
		}

		const leagueMatches = await samsLeagueMatches({ team: teamSamsUuid }); // if we found a team ID in the previous step it is used here. otherwise the function return club matches
		const matches = leagueMatches?.matches;
		const timestamp = new Date(leagueMatches?.timestamp || new Date());

		// Convert matches to iCalendar events
		const events = matches?.map((match) => {
			const startTime = dayjs(`${match.date} ${match.time}`, "YYYY-MM-DD HH:mm");
			if (!startTime.isValid()) console.warn(`Invalid date for match ${match.uuid}: ${match.date} ${match.time}`);

			const teams = [];
			const team1 = match._embedded?.team1;
			const team2 = match._embedded?.team2;
			if (team1) teams.push(team1);
			if (team2) teams.push(team2);

			const homeTeam = teams.find((t) => t.uuid === match.host)?.name;
			const guestTeam = teams.find((t) => t.uuid !== match.host)?.name;
			const league = teamLeagueName;

			const location = [];
			if (match.location?.name) location.push(match.location.name);
			if (match.location?.address?.street) location.push(match.location?.address?.street);
			if (match.location?.address?.postcode || match.location?.address?.city) {
				// Merge postal code and city if they exist
				const postalAndCity = [];
				if (match.location?.address?.postcode) postalAndCity.push(match.location?.address?.postcode);
				if (match.location?.address?.city) postalAndCity.push(match.location?.address?.city);
				location.push(postalAndCity.join(" "));
			}

			const baseDescription = [league, homeTeam ? `Heim: ${homeTeam}` : null, guestTeam ? `Gast: ${guestTeam}` : null].filter(Boolean).join(", ");
			let description = baseDescription;
			const score = match.results?.setPoints;
			if (score) description = `Ergebnis: ${score}, ${baseDescription}`;

			const eventData: IcsEvent = {
				start: { date: startTime.toDate(), type: "DATE-TIME" },
				duration: { hours: 3 },
				stamp: { date: timestamp, type: "DATE-TIME" },
				uid: match.uuid,
				summary: `${team1?.name} vs ${team2?.name}`,
				description: description,
				location: location.join(", "),
			};

			return eventData;
		});

		const icsCalendar: IcsCalendar = {
			prodId: Club.shortName,
			version: "2.0",
			events: events?.filter(Boolean) || [], // Filter out null values from invalid dates
			name: calendarTitle,
		};

		// Generate ICS content (aka the calendar file)
		const icsContent = generateIcsCalendar(icsCalendar);

		// Return the ICS file
		return new NextResponse(icsContent, {
			headers: {
				"Content-Type": "text/calendar; charset=utf-8",
				"Content-Disposition": `attachment; filename="${sanitisedTeamSlug}.ics"`,
				"Cache-Control": "public, max-age=1800, s-maxage=1800",
			},
		});
	} catch (error) {
		console.error("Error generating calendar:", error);
		return new NextResponse("Es gab ein Problem beim erzeugen des Kalender", {
			status: 500,
			headers: {
				"Content-Type": "text/plain",
				"Cache-Control": "public, max-age=3600, s-maxage=3600",
			},
		});
	}
}
