import fs from "fs";
import path from "path";
import { cachedGetMatches } from "@/app/utils/sams/cachedGetMatches";
import { cachedGetTeamIds } from "@/app/utils/sams/cachedGetClubData";
import getEvents from "./getEvents";
import { env } from "process";
import crypto from "crypto";

const ICS_FOLDER_LOCATION = "public/ics";

export function icsTeamGeneration(sbvvTeamId: (string | number)[], slug: string) {
	// calendar title (if not default)
	let calendarTitle: string = "";
	env.CLUB_SHORTNAME && (calendarTitle = env.CLUB_SHORTNAME);

	// set to be filled and used at the end of the function
	let eventSet = new Set<string>();

	// CUSTOM EVENTS
	// loop through all custom events
	if (slug == "all") {
		getEvents(30, 120).map((event) => {
			if (event.title && event.start) {
				// prepare the event data
				let customEventObjects: ICSEventComponent = { title: event.title, start: event.start };
				event.end && (customEventObjects.end = event.end);
				// location
				if (event.location) {
					if (event.location.street && event.location.postalCode) {
						customEventObjects.location = event.location.street + "\\, " + event.location.postalCode;
					} else if (event.location.street) {
						customEventObjects.location = event.location.street;
					}
					if (event.location.city) {
						if (customEventObjects.location && customEventObjects.location.length > 0) {
							customEventObjects.location = customEventObjects.location + " " + event.location.city;
						} else {
							customEventObjects.location = event.location.city;
						}
					}
					if (event.location.name) {
						if (customEventObjects.location) {
							customEventObjects.location = customEventObjects.location + "\\, " + event.location.name;
						} else {
							customEventObjects.location = event.location.name;
						}
					}
				}
				//description + url
				if (event.description) {
					customEventObjects.description = event.description;
				}
				if (event.url && !event.url.includes("https://") && !event.url.includes("http://")) {
					if (event.url && !event.url.includes("https://vcmuellheim.de") && !event.url.includes("https://vcmuellheim.de")) {
						event.url = "https://vcmuellheim.de" + event.url;
					}
					if (customEventObjects.description) {
						customEventObjects.description = customEventObjects.description + "\\n" + event.url;
					} else {
						customEventObjects.description = event.url;
					}
				}
				// turn the event data into the ICS string
				const customEventString = getICSEventComponent(customEventObjects);
				// add the complete event string to the array
				eventSet.add(customEventString);
			}
		});
	}

	// MATCHES
	// loop through all matches for the team
	cachedGetMatches(sbvvTeamId).map((match, index) => {
		if (match.uuid && match.team?.length == 2 && match.location && match.matchSeries?.name && match.matchSeries.updated) {
			// construct an end date, assuming the match lasts 3 hours
			const dateTimeEnd = new Date(match.dateObject);
			dateTimeEnd.setHours(dateTimeEnd.getHours() + 3);
			// constuct a title
			const matchTitle = match.team[0].name + (match.results ? " (" + match.results.setPoints + ") " : " vs. ") + match.team[1].name;
			// constuct the location
			const matchLocation = match.location.street + "\\, " + match.location.postalCode + " " + match.location.city + (match.location.name && "\\, " + match.location.name);
			// constuct the description
			const matchDescription =
				match.matchSeries.name +
				(match.results?.setPoints ? "\\nErgebnis: " + match.results.setPoints : "") +
				(match.host?.name && "\\nGastgeber: " + match.host.name) +
				(slug == "all" ? "\\nhttps://vcmuellheim.de/termine" : "\\nhttps://vcmuellheim.de/teams/" + slug);
			// construct the complete string
			const matchEventString = getICSEventComponent({
				title: matchTitle,
				start: match.dateObject,
				end: dateTimeEnd,
				id: match.uuid,
				updated: new Date(match.matchSeries.updated),
				location: matchLocation,
				description: matchDescription,
			});
			// add this match to the array
			eventSet.add(matchEventString);
		}

		// enhance the default calender name with the teams & league name
		if (sbvvTeamId.length == 1 && index == 0) {
			match.team?.forEach((team) => {
				if (team.id == sbvvTeamId[0] && match.matchSeries?.name) {
					calendarTitle = team.name + " - " + match.matchSeries.name;
				}
			});
		}
	});

	// handle the case when there are no matches or custom events because its required for the ICS file to have at least one event
	if (eventSet.size == 0) {
		let yesterdayStart = new Date();
		yesterdayStart.setDate(yesterdayStart.getDate() - 3);
		let yesterdayEnd = new Date(yesterdayStart);
		yesterdayEnd.setMinutes(yesterdayEnd.getMinutes() + 15);
		let noEvents: ICSEventComponent = { title: "Derzeit sind keine Termine verfügbar.", start: yesterdayStart, end: yesterdayEnd };
		slug == "all" ? (noEvents.description = "https://vcmuellheim.de/termine") : (noEvents.description = "https://vcmuellheim.de/teams/" + slug);
		eventSet.add(getICSEventComponent(noEvents));
	}
	// build the output string
	let result = getICSComponent("start", calendarTitle) + Array.from(eventSet).join("\n") + getICSComponent("end");
	fs.writeFileSync(path.join(ICS_FOLDER_LOCATION, slug) + ".ics", result);
}

export function icsAllGeneration() {
	icsTeamGeneration(cachedGetTeamIds("id"), "all");
}

export function toICSFormat(date: Date): string {
	let dateICS = date
		.toISOString()
		.replaceAll("-", "")
		.replaceAll(":", "")
		.replace(/\.[0-9]{3}/, ""); // removes milliseconds
	return dateICS;
}

export function getICSComponent(component: "start" | "end", title?: string): string | void {
	// BEGIN:VCALENDAR
	// X-WR-CALNAME:VC Müllheim
	// PRODID:-//Volleyballclub Müllheim e.V.//Website//DE
	// VERSION:2.0
	// CALSCALE:GREGORIAN

	// PRODID
	let calProdId = "Unknown";
	if (env.CLUB_NAME) {
		calProdId = "\nPRODID:-//" + env.CLUB_NAME + "//Website//DE";
	} else if (title) {
		calProdId = "\nPRODID:-//" + title + "//Website//DE";
	} else {
		console.log("🚨 Calendar Product ID was not identified!");
	}
	// TITLE
	let calTitle = "\nX-WR-CALNAME:Unknown";
	if (title && title?.length > 0) {
		calTitle = "\nX-WR-CALNAME:" + title;
	} else if (env.CLUB_SHORTNAME) {
		calTitle = "\nX-WR-CALNAME:" + env.CLUB_SHORTNAME;
	} else {
		console.log("🚨 Calendar title was not identified!");
	}
	let start = "BEGIN:VCALENDAR" + calTitle + calProdId + "\nVERSION:2.0\nCALSCALE:GREGORIAN\n";
	// 	BEGIN:VTIMEZONE
	// TZID:Europe/Berlin
	// LAST-MODIFIED:REPLACE_TODAY
	// TZURL:https://www.tzurl.org/zoneinfo/Europe/Berlin
	// X-LIC-LOCATION:Europe/Berlin
	// X-PROLEPTIC-TZNAME:LMT
	// BEGIN:STANDARD
	// TZNAME:CET
	// TZOFFSETFROM:+005328
	// TZOFFSETTO:+0100
	// DTSTART:18930401T000000
	// END:STANDARD
	// BEGIN:DAYLIGHT
	// TZNAME:CEST
	// TZOFFSETFROM:+0100
	// TZOFFSETTO:+0200
	// DTSTART:19160430T230000
	// RDATE:19400401T020000
	// RDATE:19430329T020000
	// RDATE:19460414T020000
	// RDATE:19470406T030000
	// RDATE:19480418T020000
	// RDATE:19490410T020000
	// RDATE:19800406T020000
	// END:DAYLIGHT
	// BEGIN:STANDARD
	// TZNAME:CET
	// TZOFFSETFROM:+0200
	// TZOFFSETTO:+0100
	// DTSTART:19161001T010000
	// RDATE:19421102T030000
	// RDATE:19431004T030000
	// RDATE:19441002T030000
	// RDATE:19451118T030000
	// RDATE:19461007T030000
	// END:STANDARD
	// BEGIN:DAYLIGHT
	// TZNAME:CEST
	// TZOFFSETFROM:+0100
	// TZOFFSETTO:+0200
	// DTSTART:19170416T020000
	// RRULE:FREQ=YEARLY;UNTIL=19180415T010000Z;BYMONTH=4;BYDAY=3MO
	// END:DAYLIGHT
	// BEGIN:STANDARD
	// TZNAME:CET
	// TZOFFSETFROM:+0200
	// TZOFFSETTO:+0100
	// DTSTART:19170917T030000
	// RRULE:FREQ=YEARLY;UNTIL=19180916T010000Z;BYMONTH=9;BYDAY=3MO
	// END:STANDARD
	// BEGIN:DAYLIGHT
	// TZNAME:CEST
	// TZOFFSETFROM:+0100
	// TZOFFSETTO:+0200
	// DTSTART:19440403T020000
	// RRULE:FREQ=YEARLY;UNTIL=19450402T010000Z;BYMONTH=4;BYDAY=1MO
	// END:DAYLIGHT
	// BEGIN:DAYLIGHT
	// TZNAME:CEMT
	// TZOFFSETFROM:+0200
	// TZOFFSETTO:+0300
	// DTSTART:19450524T020000
	// RDATE:19470511T030000
	// END:DAYLIGHT
	// BEGIN:DAYLIGHT
	// TZNAME:CEST
	// TZOFFSETFROM:+0300
	// TZOFFSETTO:+0200
	// DTSTART:19450924T030000
	// RDATE:19470629T030000
	// END:DAYLIGHT
	// BEGIN:STANDARD
	// TZNAME:CET
	// TZOFFSETFROM:+0100
	// TZOFFSETTO:+0100
	// DTSTART:19460101T000000
	// RDATE:19800101T000000
	// END:STANDARD
	// BEGIN:STANDARD
	// TZNAME:CET
	// TZOFFSETFROM:+0200
	// TZOFFSETTO:+0100
	// DTSTART:19471005T030000
	// RRULE:FREQ=YEARLY;UNTIL=19491002T010000Z;BYMONTH=10;BYDAY=1SU
	// END:STANDARD
	// BEGIN:STANDARD
	// TZNAME:CET
	// TZOFFSETFROM:+0200
	// TZOFFSETTO:+0100
	// DTSTART:19800928T030000
	// RRULE:FREQ=YEARLY;UNTIL=19950924T010000Z;BYMONTH=9;BYDAY=-1SU
	// END:STANDARD
	// BEGIN:DAYLIGHT
	// TZNAME:CEST
	// TZOFFSETFROM:+0100
	// TZOFFSETTO:+0200
	// DTSTART:19810329T020000
	// RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
	// END:DAYLIGHT
	// BEGIN:STANDARD
	// TZNAME:CET
	// TZOFFSETFROM:+0200
	// TZOFFSETTO:+0100
	// DTSTART:19961027T030000
	// RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
	// END:STANDARD
	// END:VTIMEZONE
	// END:VCALENDAR
	let end =
		"\nBEGIN:VTIMEZONE\nTZID:Europe/Berlin\nLAST-MODIFIED:REPLACE_TODAY\nTZURL:https://www.tzurl.org/zoneinfo/Europe/Berlin\nX-LIC-LOCATION:Europe/Berlin\nX-PROLEPTIC-TZNAME:LMT\nBEGIN:STANDARD\nTZNAME:CET\nTZOFFSETFROM:+005328\nTZOFFSETTO:+0100\nDTSTART:18930401T000000\nEND:STANDARD\nBEGIN:DAYLIGHT\nTZNAME:CEST\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nDTSTART:19160430T230000\nRDATE:19400401T020000\nRDATE:19430329T020000\nRDATE:19460414T020000\nRDATE:19470406T030000\nRDATE:19480418T020000\nRDATE:19490410T020000\nRDATE:19800406T020000\nEND:DAYLIGHT\nBEGIN:STANDARD\nTZNAME:CET\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nDTSTART:19161001T010000\nRDATE:19421102T030000\nRDATE:19431004T030000\nRDATE:19441002T030000\nRDATE:19451118T030000\nRDATE:19461007T030000\nEND:STANDARD\nBEGIN:DAYLIGHT\nTZNAME:CEST\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nDTSTART:19170416T020000\nRRULE:FREQ=YEARLY;UNTIL=19180415T010000Z;BYMONTH=4;BYDAY=3MO\nEND:DAYLIGHT\nBEGIN:STANDARD\nTZNAME:CET\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nDTSTART:19170917T030000\nRRULE:FREQ=YEARLY;UNTIL=19180916T010000Z;BYMONTH=9;BYDAY=3MO\nEND:STANDARD\nBEGIN:DAYLIGHT\nTZNAME:CEST\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nDTSTART:19440403T020000\nRRULE:FREQ=YEARLY;UNTIL=19450402T010000Z;BYMONTH=4;BYDAY=1MO\nEND:DAYLIGHT\nBEGIN:DAYLIGHT\nTZNAME:CEMT\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0300\nDTSTART:19450524T020000\nRDATE:19470511T030000\nEND:DAYLIGHT\nBEGIN:DAYLIGHT\nTZNAME:CEST\nTZOFFSETFROM:+0300\nTZOFFSETTO:+0200\nDTSTART:19450924T030000\nRDATE:19470629T030000\nEND:DAYLIGHT\nBEGIN:STANDARD\nTZNAME:CET\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0100\nDTSTART:19460101T000000\nRDATE:19800101T000000\nEND:STANDARD\nBEGIN:STANDARD\nTZNAME:CET\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nDTSTART:19471005T030000\nRRULE:FREQ=YEARLY;UNTIL=19491002T010000Z;BYMONTH=10;BYDAY=1SU\nEND:STANDARD\nBEGIN:STANDARD\nTZNAME:CET\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nDTSTART:19800928T030000\nRRULE:FREQ=YEARLY;UNTIL=19950924T010000Z;BYMONTH=9;BYDAY=-1SU\nEND:STANDARD\nBEGIN:DAYLIGHT\nTZNAME:CEST\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nDTSTART:19810329T020000\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\nEND:DAYLIGHT\nBEGIN:STANDARD\nTZNAME:CET\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nDTSTART:19961027T030000\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\nEND:STANDARD\nEND:VTIMEZONE\nEND:VCALENDAR";
	if (component == "start") {
		return start;
	} else if (component == "end") {
		return end;
	} else {
		throw "🚨 ICSComponent attempted to be generated with invalid component name.";
	}
}

type ICSEventComponent = { title: string; start: Date; end?: Date; id?: string; location?: string; description?: string; updated?: Date; timezone?: string };
export function getICSEventComponent(props: ICSEventComponent): string {
	// input test
	if (!props.title || !props.start) {
		throw "🚨 ICS Event Component attempted to be generated without title or start date.";
	}
	// replace missing data
	!props.updated && (props.updated = new Date());
	!props.timezone && (props.timezone = "Europe/Berlin");
	!props.id &&
		(props.id = crypto
			.createHash("md5")
			.update(props.title + props.start.getDate())
			.digest("hex"));

	// build the output string
	// BEGIN:VEVENT
	// UID:71fc6724-818b-45bc-9b73-7abba135e21e
	// SUMMARY:VfR Merzhausen 1 (3:1) VC Müllheim
	// DTSTART:20231014T120000Z
	// DTEND:20231014T150000Z
	// LOCATION:Am Marktplatz 1\, 79249 Merzhausen\, Sporthalle Merzhausen
	// DESCRIPTION:Landesliga West Herren\nErgebnis: 3:1\nGastgeber: VfR Merzhausen 1\nhttps://vcmuellheim.de/termine
	// DTSTAMP:20240420T184955Z
	// TZID:Europe/Berlin
	// END:VEVENT
	let output = "BEGIN:VEVENT";
	output = output.concat("\nUID:" + props.id);
	output = output.concat("\nSUMMARY:" + props.title);
	// START, END & ALL DAY EVENTS
	if (props.start.getUTCHours() + props.start.getUTCMinutes() == 0 || (props.end && props.end.getUTCHours() + props.end.getUTCMinutes() == 0)) {
		// if only a start date without time is provided, then an all day event should be created in the format:
		// DTSTART;VALUE=DATE:19801231
		// DTEND;VALUE=DATE:19801231
		output = output.concat("\nDTSTART;VALUE=DATE:" + props.start.toISOString().replaceAll("-", "").slice(0, 8));
		!props.end && (props.end = new Date(props.start)); // in case there is only a start without time, duplicate it as end for a "1-day-all-day-event"
		// add 1 day to the date so the all day event ends at midnight
		props.end.setDate(props.end.getDate() + 1);
		output = output.concat("\nDTEND;VALUE=DATE:" + props.end.toISOString().replaceAll("-", "").slice(0, 8));
	} else {
		// START
		output = output.concat("\nDTSTART:" + toICSFormat(props.start));
		// END
		if (!props.end) {
			props.end = new Date(props.start);
			props.end.setHours(props.start.getHours() + 2);
		}
		output = output.concat("\nDTEND:" + toICSFormat(props.end));
	}
	// LOCATION, DESCRIPTION & MORE
	props.location && (output = output.concat("\nLOCATION:" + props.location));
	props.description && (output = output.concat("\nDESCRIPTION:" + props.description));
	output = output.concat("\nDTSTAMP:" + toICSFormat(props.updated));
	output = output.concat("\nTZID:" + props.timezone);
	output = output.concat("\nEND:VEVENT");

	return output;
}
