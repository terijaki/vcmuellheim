import fs from "fs";
import path from "path";
import { getMatches } from "@/app/utils/sams/jsonMatches";
import { getTeamIds } from "@/app/utils/sams/jsonClubData";

const ICS_FOLDER_LOCATION = "public/ics";
const TEMPLATE_START = "BEGIN:VEVENT";
const TEMPLATE_END = "END:VEVENT";

export function icsTeamGeneration(sbvvId: (string | number)[], slug: string) {
	const template: string = fs.readFileSync(path.join(ICS_FOLDER_LOCATION, "template.ics")).toString();
	const templateStart = template.slice(0, template.indexOf(TEMPLATE_START));
	const templateEnd = template.slice(template.indexOf(TEMPLATE_END) + TEMPLATE_END.length);
	const templateBody = template.slice(template.indexOf(TEMPLATE_START), template.indexOf(TEMPLATE_END) + TEMPLATE_END.length);

	let matchArray: string[] = [];
	// loop through all matches for the team
	getMatches(sbvvId).map((match) => {
		if (match.uuid && match.team?.length == 2 && match.location && match.matchSeries?.name && match.matchSeries.updated) {
			// use the match update date as the date this entry is updated
			const dateLastUpdated = new Date(match.matchSeries.updated);
			// construct a start date off the match.date and match.time
			const dateTimeStart: Date = new Date();
			dateTimeStart.setFullYear(Number(match.date.slice(-4)));
			dateTimeStart.setMonth(Number(match.date.slice(3, 5)) - 1); // -1 because January is 0
			dateTimeStart.setDate(Number(match.date.slice(0, 2)));
			dateTimeStart.setHours(Number(match.time?.slice(0, 2)));
			dateTimeStart.setMinutes(Number(match.time?.slice(-2)));
			dateTimeStart.setSeconds(0);
			// construct an end date, assuming the match lasts 3 hours
			const dateTimeEnd = new Date(dateTimeStart);
			dateTimeEnd.setHours(dateTimeEnd.getHours() + 3);
			// begin replacing the template
			let matchConstruct: string = templateBody;
			matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_UUID", match.uuid);
			matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_UPDATED", toICSFormat(dateLastUpdated));
			matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_TIMEZONE", "Europe/Berlin");
			matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_DATETIME_START", toICSFormat(dateTimeStart));
			matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_DATETIME_END", toICSFormat(dateTimeEnd));
			matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_SUMMARY", match.team[0].name + (match.results ? " (" + match.results.setPoints + ") " : " vs. ") + match.team[1].name);
			matchConstruct = matchConstruct.replaceAll(
				"REPLACE_MATCH_LOCATION",
				match.location.street + "\\, " + match.location.postalCode + " " + match.location.city + (match.location.name && "\\, " + match.location.name)
			);
			matchConstruct = matchConstruct.replaceAll(
				"REPLACE_MATCH_DESCRIPTION",
				match.matchSeries.name +
					(match.results?.setPoints ? "\\nErgebnis: " + match.results.setPoints : "") +
					(match.host?.name && "\\nGastgeber: " + match.host.name) +
					(slug == "all" ? "\\nhttps://vcmuellheim.de/termine" : "\\nhttps://vcmuellheim.de/teams/" + slug)
			);
			matchArray.push(matchConstruct);
		}
	});

	// handle the case when there are not matches because its required for the ICS file to have at least one event
	if (matchArray.length == 0) {
		let yesterdayStart = new Date();
		yesterdayStart.setDate(yesterdayStart.getDate() - 3);
		let yesterdayEnd = new Date(yesterdayStart);
		yesterdayEnd.setMinutes(yesterdayEnd.getMinutes() + 15);
		let matchConstruct: string = templateBody;
		matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_UUID", Date.now().toString());
		matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_UPDATED", toICSFormat(new Date()));
		matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_TIMEZONE", "Europe/Berlin");
		matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_DATETIME_START", toICSFormat(yesterdayStart));
		matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_DATETIME_END", toICSFormat(yesterdayEnd));
		matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_SUMMARY", "Derzeit keine neuen Termine verfügbar");
		matchConstruct = matchConstruct.replaceAll("LOCATION:REPLACE_MATCH_LOCATION\n", "");
		matchConstruct = matchConstruct.replaceAll("DESCRIPTION:REPLACE_MATCH_DESCRIPTION\n", "");
		matchArray.push(matchConstruct);
	}

	let result =
		templateStart +
		matchArray.reduce((a, b) => {
			return a.concat("\n" + b);
		}) +
		templateEnd;
	fs.writeFileSync(path.join(ICS_FOLDER_LOCATION, slug) + ".ics", result);
}

export function icsAllGeneration() {
	icsTeamGeneration(getTeamIds("id"), "all");
}

export function toICSFormat(date: Date) {
	let dateICS: string = date.toISOString().slice(0, -5).replaceAll("-", "").replaceAll(":", "").replaceAll(".", "");
	return dateICS;
}
