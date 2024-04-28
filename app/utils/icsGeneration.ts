import fs from "fs";
import path from "path";
import { cachedGetMatches } from "@/app/utils/sams/cachedGetMatches";
import { cachedGetTeamIds } from "@/app/utils/sams/cachedGetClubData";
import getEvents from "./getEvents";

const ICS_FOLDER_LOCATION = "public/ics",
	TEMPLATE_START = "BEGIN:VEVENT",
	TEMPLATE_END = "END:VEVENT";

export function icsTeamGeneration(sbvvTeamId: (string | number)[], slug: string) {
	// read the template to get the template
	const template: string = fs.readFileSync(path.join(ICS_FOLDER_LOCATION, "template.ics")).toString();
	let templateStart = template.slice(0, template.indexOf(TEMPLATE_START));
	const templateEnd = template.slice(template.indexOf(TEMPLATE_END) + TEMPLATE_END.length);
	const templateBody = template.slice(template.indexOf(TEMPLATE_START), template.indexOf(TEMPLATE_END) + TEMPLATE_END.length);

	// CUSTOM EVENTS
	let eventArray: string[] = [];
	// loop through all custom events
	if (slug == "all") {
		getEvents(30, 120).map((event) => {
			if (event.title && event.start) {
				let eventConstruct: string = templateBody;
				eventConstruct = eventConstruct.replaceAll("REPLACE_EVENTTEMPLATE_UUID", event.title + event.start);
				eventConstruct = eventConstruct.replaceAll("REPLACE_EVENTTEMPLATE_UPDATED", toICSFormat(new Date()));
				eventConstruct = eventConstruct.replaceAll("REPLACE_EVENTTEMPLATE_TIMEZONE", "Europe/Berlin");
				// start and end date
				if (event.start.getUTCHours() + event.start.getUTCMinutes() == 0) {
					// ALL DAY EVENTS
					// if only a start date without time is provided, then an all day event should be created in the format:
					// DTSTART;VALUE=DATE:19801231
					// DTEND;VALUE=DATE:19801231
					eventConstruct = eventConstruct.replaceAll("DTSTART:REPLACE_EVENTTEMPLATE_DATETIME_START", "DTSTART;VALUE=DATE:" + event.start.toISOString().replaceAll("-", "").slice(0, 8));
					if (event.end) {
						eventConstruct = eventConstruct.replaceAll("DTEND:REPLACE_EVENTTEMPLATE_DATETIME_END", "DTEND;VALUE=DATE:" + event.end.toISOString().replaceAll("-", "").slice(0, 8));
					} else {
						eventConstruct = eventConstruct.replaceAll("DTEND:REPLACE_EVENTTEMPLATE_DATETIME_END", "DTEND;VALUE=DATE:" + event.start.toISOString().replaceAll("-", "").slice(0, 8));
					}
				} else {
					eventConstruct = eventConstruct.replaceAll("REPLACE_EVENTTEMPLATE_DATETIME_START", toICSFormat(event.start));

					if (event.end) {
						eventConstruct = eventConstruct.replaceAll("REPLACE_EVENTTEMPLATE_DATETIME_END", toICSFormat(event.end));
					} else {
						eventConstruct = eventConstruct.replaceAll("REPLACE_EVENTTEMPLATE_DATETIME_END", toICSFormat(new Date(event.start.setHours(event.start.getHours() + 2))));
					}
				}

				// summary
				eventConstruct = eventConstruct.replaceAll("REPLACE_EVENTTEMPLATE_SUMMARY", event.title);
				// location
				if (event.location) {
					let locationString = "";
					if (event.location.street && event.location.postalCode) {
						locationString = locationString + event.location.street + "\\, " + event.location.postalCode;
					} else if (event.location.street) {
						locationString = locationString + event.location.street;
					}
					if (event.location.city) {
						if (locationString.length > 0) {
							locationString = locationString + " ";
						}
						locationString = locationString + event.location.city;
					}
					if (event.location.name) {
						locationString = locationString + "\\, " + event.location.name;
					}
					if (locationString.length > 0) {
						eventConstruct = eventConstruct.replaceAll("REPLACE_EVENTTEMPLATE_LOCATION", locationString);
					} else {
						// remove the template string if there is nothing to include
						eventConstruct = eventConstruct.replaceAll("LOCATION:REPLACE_EVENTTEMPLATE_LOCATION\n", "");
					}
				}
				// description
				if (!event.description && !event.url) {
					// remove the template string if there is nothing to include
					eventConstruct = eventConstruct.replaceAll("DESCRIPTION:REPLACE_EVENTTEMPLATE_DESCRIPTION\n", "");
				} else {
					let descriptioString: string = "";
					if (event.description) {
						descriptioString = event.description;
					}
					if (event.url && !event.url.includes("https://") && !event.url.includes("http://")) {
						if (event.url && !event.url.includes("https://vcmuellheim.de") && !event.url.includes("https://vcmuellheim.de")) {
							event.url = "https://vcmuellheim.de" + event.url;
						}
						if (event.description && event.description.length > 0) {
							descriptioString = descriptioString + "\n";
						}
						descriptioString = descriptioString + event.url;
					}
					eventConstruct = eventConstruct.replaceAll("REPLACE_EVENTTEMPLATE_DESCRIPTION", descriptioString);
				}
				// add the complete event string to the array
				eventArray.push(eventConstruct);
			}
		});
	}

	// MATCHES
	let matchArray: string[] = [];
	// loop through all matches for the team
	cachedGetMatches(sbvvTeamId).map((match, index) => {
		if (match.uuid && match.team?.length == 2 && match.location && match.matchSeries?.name && match.matchSeries.updated) {
			// use the match update date as the date this entry is updated
			const dateLastUpdated = new Date(match.matchSeries.updated);
			// construct an end date, assuming the match lasts 3 hours
			const dateTimeEnd = new Date(match.dateObject);
			dateTimeEnd.setHours(dateTimeEnd.getHours() + 3);
			// begin replacing the template
			let matchConstruct: string = templateBody;
			matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_UUID", match.uuid);
			matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_UPDATED", toICSFormat(dateLastUpdated));
			matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_TIMEZONE", "Europe/Berlin");
			matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_DATETIME_START", toICSFormat(match.dateObject));
			matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_DATETIME_END", toICSFormat(dateTimeEnd));
			matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_SUMMARY", match.team[0].name + (match.results ? " (" + match.results.setPoints + ") " : " vs. ") + match.team[1].name);
			matchConstruct = matchConstruct.replaceAll(
				"REPLACE_EVENTTEMPLATE_LOCATION",
				match.location.street + "\\, " + match.location.postalCode + " " + match.location.city + (match.location.name && "\\, " + match.location.name)
			);
			matchConstruct = matchConstruct.replaceAll(
				"REPLACE_EVENTTEMPLATE_DESCRIPTION",
				match.matchSeries.name +
					(match.results?.setPoints ? "\\nErgebnis: " + match.results.setPoints : "") +
					(match.host?.name && "\\nGastgeber: " + match.host.name) +
					(slug == "all" ? "\\nhttps://vcmuellheim.de/termine" : "\\nhttps://vcmuellheim.de/teams/" + slug)
			);
			matchArray.push(matchConstruct);
		}

		// enhance the default calender name with the teams & league name
		if (sbvvTeamId.length == 1 && index == 0) {
			match.team?.forEach((team) => {
				if (team.id == sbvvTeamId[0] && match.matchSeries?.name) {
					templateStart = templateStart.replace("X-WR-CALNAME:VC Müllheim", "X-WR-CALNAME:" + team.name + " - " + match.matchSeries.name);
				}
			});
		}
	});

	// handle the case when there are no matches or events because its required for the ICS file to have at least one event
	if (matchArray.length == 0 && eventArray.length == 0) {
		let yesterdayStart = new Date();
		yesterdayStart.setDate(yesterdayStart.getDate() - 3);
		let yesterdayEnd = new Date(yesterdayStart);
		yesterdayEnd.setMinutes(yesterdayEnd.getMinutes() + 15);
		let matchConstruct: string = templateBody;
		matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_UUID", Date.now().toString());
		matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_UPDATED", toICSFormat(new Date()));
		matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_TIMEZONE", "Europe/Berlin");
		matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_DATETIME_START", toICSFormat(yesterdayStart));
		matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_DATETIME_END", toICSFormat(yesterdayEnd));
		matchConstruct = matchConstruct.replaceAll("REPLACE_EVENTTEMPLATE_SUMMARY", "Derzeit sind keine Termine verfügbar.");
		matchConstruct = matchConstruct.replaceAll("LOCATION:REPLACE_EVENTTEMPLATE_LOCATION\n", "");
		matchConstruct = matchConstruct.replaceAll("DESCRIPTION:REPLACE_EVENTTEMPLATE_DESCRIPTION\n", slug == "all" ? "\\nhttps://vcmuellheim.de/termine" : "\\nhttps://vcmuellheim.de/teams/" + slug);
		matchArray.push(matchConstruct);
	}

	// build the output string
	let eventsToAdd = "";
	if (eventArray.length > 0) {
		eventsToAdd = eventArray.reduce((a, b) => {
			return a.concat("\n" + b);
		});
	}
	let matchesToAdd = "";
	if (matchArray.length > 0) {
		matchesToAdd = matchArray.reduce((a, b) => {
			return a.concat("\n" + b);
		});
	}
	if (eventsToAdd.length > 0 && matchesToAdd.length > 0) {
		eventsToAdd = eventsToAdd + "\n";
	}
	let result = templateStart + eventsToAdd + matchesToAdd + templateEnd;
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
