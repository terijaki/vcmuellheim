export default function convertDate(date: string, time?: string): Date {
	let safeTime = time;
	// add a time
	if (!time) {
		safeTime = "00:00";
	}
	// construct the date from 14.03.1980 to 1980-03-14
	const dateInput: string = `${date.substring(6, 10)}-${date.substring(3, 5)}-${date.substring(0, 2)}`;

	// adjust the timezone since we are dealing with the date and hours but sams does not deliver TZ information
	let timezone = "+01:00"; // UTC+1, CET, winter time in Germany
	const isDST = require("is-dst"); // this tool checks if the date provides is in Daylight Saving Time ranges
	if (isDST(new Date(dateInput))) {
		timezone = "+02:00"; // UTC+2, CEST, summer time in Germay
	}

	// add time and timezone
	const dateObject = new Date(`${dateInput}T${time}${timezone}`);

	return dateObject;
}
