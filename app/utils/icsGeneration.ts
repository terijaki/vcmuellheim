import fs from "fs";
import path from "path";
import { cachedGetMatches } from "@/app/utils/sams/cachedGetMatches";
import { cachedGetTeamIds } from "@/app/utils/sams/cachedGetClubData";

const ICS_FOLDER_LOCATION = "public/ics",
	TEMPLATE_START = "BEGIN:VEVENT",
	TEMPLATE_END = "END:VEVENT";

export function icsTeamGeneration(sbvvTeamId: (string | number)[], slug: string) {
	const template: string = fs.readFileSync(path.join(ICS_FOLDER_LOCATION, "template.ics")).toString();
	let templateStart = template.slice(0, template.indexOf(TEMPLATE_START));
	const templateEnd = template.slice(template.indexOf(TEMPLATE_END) + TEMPLATE_END.length);
	const templateBody = template.slice(template.indexOf(TEMPLATE_START), template.indexOf(TEMPLATE_END) + TEMPLATE_END.length);
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
			matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_UUID", match.uuid);
			matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_UPDATED", toICSFormat(dateLastUpdated));
			matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_TIMEZONE", "Europe/Berlin");
			matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_DATETIME_START", toICSFormat(match.dateObject));
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

		// enhance the default calender name with the teams & league name
		if (sbvvTeamId.length == 1 && index == 0) {
			match.team?.forEach((team) => {
				if (team.id == sbvvTeamId[0] && match.matchSeries?.name) {
					templateStart = templateStart.replace("X-WR-CALNAME:VC Müllheim", "X-WR-CALNAME:" + team.name + " - " + match.matchSeries.name);
				}
			});
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
		matchConstruct = matchConstruct.replaceAll("REPLACE_MATCH_SUMMARY", "Derzeit sind keine Termine verfügbar.");
		matchConstruct = matchConstruct.replaceAll("LOCATION:REPLACE_MATCH_LOCATION\n", "");
		matchConstruct = matchConstruct.replaceAll("DESCRIPTION:REPLACE_MATCH_DESCRIPTION\n", slug == "all" ? "\\nhttps://vcmuellheim.de/termine" : "\\nhttps://vcmuellheim.de/teams/" + slug);
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
