import fs from "fs";
import path from "path";

export const EVENTS_FOLDER = "data/events";

export type eventObject = {
	title: string;
	start: Date;
	end?: Date;
	uuid?: string;
	url?: string;
	thumbnail?: string;
	description?: string;
	location?: {
		city?: string;
		postalCode?: string | number;
		street?: string;
		name?: string;
	};
};

export default function getEvents(daysInPast = 0, daysInFuture = 90): eventObject[] {
	const today = new Date();
	let minDate = new Date(today.setDate(today.getDate() - daysInPast)); // # days in the past
	let maxDate = new Date(today.setDate(today.getDate() + daysInFuture)); // # days in the future

	if (fs.existsSync(EVENTS_FOLDER)) {
		const eventFiles = fs.readdirSync(EVENTS_FOLDER);
		const eventObjects = eventFiles.map((event) => {
			const eventFile = fs.readFileSync(path.join(EVENTS_FOLDER, event));
			let eventObject = JSON.parse(eventFile.toString());
			if (eventObject.start) {
				eventObject.start = new Date(eventObject.start);
			}
			if (eventObject.end) {
				eventObject.end = new Date(eventObject.end);
			}
			return eventObject;
		});

		// remove events outside the specified range, relative to today
		const filteredEvents = eventObjects.filter((event) => (minDate < event.start.getTime() && maxDate > event.start.getTime()) || (event.end && minDate < event.end.getTime() && maxDate > event.end.getTime()));

		return filteredEvents;
	} else {
		return [];
	}
}
