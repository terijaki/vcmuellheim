import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { generateIcsCalendar, type IcsCalendar, type IcsEvent } from "ts-ics";
import type { Event, Team } from "@/lib/db/types";
import { Club } from "@/project.config";
import { createDb } from "@/lib/db/electrodb-client";
import { parseLambdaEnv } from "../utils/env";
import { createDynamoDocClient, createLambdaResources } from "../utils/resources";
import { Sentry } from "../utils/sentry";
import { IcsCalendarLambdaEnvironmentSchema } from "./types";

const env = parseLambdaEnv(IcsCalendarLambdaEnvironmentSchema);

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const SAMS_API_URL = env.SAMS_API_URL;

// Initialize Logger and Tracer outside handler for reuse across invocations
const { logger, tracer } = createLambdaResources("vcm-ics-calendar");
const docClient = createDynamoDocClient(tracer);

// Lazily initialized DB — depends on CONTENT_TABLE_NAME env var
const db = () => createDb(docClient, env.CONTENT_TABLE_NAME);

/**
 * Fetch custom events from DynamoDB
 * Includes events from the past 14 days up to future events
 * Optionally filter by teamId if provided
 */
async function fetchCustomEvents(teamId?: string): Promise<Event[]> {
const fourteenDaysAgo = dayjs().subtract(14, "day").toISOString();
const query = db().event.query.byType({ type: "event" }).gte({ startDate: fourteenDaysAgo });
const result = await (teamId
? query.where((attr, op) => op.contains(attr.teamIds, teamId)).go({ pages: "all" })
: query.go({ pages: "all" }));
return result.data as Event[];
}

/**
 * Convert a custom event to ICS format
 */
function convertEventToIcs(event: Event, timestamp: Date): IcsEvent {
const startTime = dayjs(event.startDate);
const endTime = event.endDate ? dayjs(event.endDate) : undefined;

let duration: { hours: number; minutes?: number } | { minutes: number } | undefined;
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
} else {
duration = { hours: 2 };
}
} else {
duration = { hours: 2 };
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

const lambdaHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
logger.appendKeys({
path: event.path || "unknown",
pathParameters: event.pathParameters,
headers: {
host: event.headers?.host,
origin: event.headers?.origin,
"cloudfront-viewer-country": event.headers?.["cloudfront-viewer-country"],
},
});

try {
let rawTeamSlug = event.pathParameters?.teamSlug;

if (!rawTeamSlug && event.pathParameters?.proxy) {
const proxyPath = event.pathParameters.proxy;
const match = proxyPath.match(/^ics\/(.+)$/);
if (match) {
rawTeamSlug = match[1];
}
}

const teamSlug = rawTeamSlug?.replace(".ics", "").toLowerCase();

logger.info("Processing ICS calendar request", {
teamSlug,
rawTeamSlug,
fullPath: event.path,
proxyParam: event.pathParameters?.proxy,
});

let teamSamsUuid: string | undefined;
let teamId: string | undefined;
let teamLeagueName: string | undefined;
let calendarTitle: string = Club.shortName;

if (!teamSlug || teamSlug === "all") {
calendarTitle = `${calendarTitle} - Vereinskalender`;
} else {
const teamResult = await db().team.query.bySlug({ slug: teamSlug }).go({ limit: 1 });
const foundTeam = teamResult.data[0] as Team | undefined;
if (!foundTeam) {
return {
statusCode: 404,
headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
body: "Team nicht gefunden",
};
}

if (foundTeam.name) calendarTitle = `${calendarTitle} - ${foundTeam.name}`;
if (foundTeam.league) teamLeagueName = foundTeam.league;
teamSamsUuid = foundTeam.sbvvTeamId;
teamId = foundTeam.id;
}

const queryString = teamSamsUuid ? `?team=${teamSamsUuid}` : "";
const response = await fetch(`${SAMS_API_URL}/matches${queryString}`);
if (!response.ok) {
throw new Error(`Failed to fetch matches: ${response.statusText}`);
}

const data = await response.json();
const matches = data.matches || [];
const timestamp = new Date(data.timestamp || new Date());

const matchEvents: IcsEvent[] = matches
.map(
(match: {
uuid: string;
date: string;
time: string;
_embedded?: { team1?: { uuid: string; name: string }; team2?: { uuid: string; name: string } };
host?: string;
location?: { name?: string; address?: { street?: string; postcode?: string; city?: string } };
results?: { setPoints?: string };
}) => {
const startTime = dayjs.tz(`${match.date} ${match.time}`, "YYYY-MM-DD HH:mm", "Europe/Berlin").utc();
if (!startTime.isValid()) {
console.warn(`Invalid date for match ${match.uuid}: ${match.date} ${match.time}`);
return null;
}

const team1 = match._embedded?.team1;
const team2 = match._embedded?.team2;
const homeTeam = [team1, team2].find((t) => t?.uuid === match.host)?.name;
const guestTeam = [team1, team2].find((t) => t?.uuid !== match.host)?.name;

const locationParts: string[] = [];
if (match.location?.name) locationParts.push(match.location.name);
if (match.location?.address?.street) locationParts.push(match.location.address.street);
const postalCity = [match.location?.address?.postcode, match.location?.address?.city].filter(Boolean).join(" ");
if (postalCity) locationParts.push(postalCity);

const baseDesc = [teamLeagueName, homeTeam ? `Heim: ${homeTeam}` : null, guestTeam ? `Gast: ${guestTeam}` : null].filter(Boolean).join(", ");
const score = match.results?.setPoints;
const description = score ? `Ergebnis: ${score}, ${baseDesc}` : baseDesc;

const eventData: IcsEvent = {
start: { date: startTime.toDate(), type: "DATE-TIME" },
duration: { hours: 3 },
stamp: { date: timestamp, type: "DATE-TIME" },
uid: match.uuid,
summary: `${team1?.name} vs ${team2?.name}`,
description,
location: locationParts.join(", "),
};

return eventData;
},
)
.filter(Boolean);

const customEvents = await fetchCustomEvents(teamId);
const customIcsEvents = customEvents.map((evt) => convertEventToIcs(evt, timestamp));

const events: IcsEvent[] = [...matchEvents, ...customIcsEvents];

const icsCalendar: IcsCalendar = {
prodId: Club.shortName,
version: "2.0",
events,
name: calendarTitle,
};

const icsContent = generateIcsCalendar(icsCalendar);

return {
statusCode: 200,
headers: {
"Content-Type": "text/calendar; charset=utf-8",
"Content-Disposition": `attachment; filename="${teamSlug || "all"}.ics"`,
"Cache-Control": "public, max-age=1800, s-maxage=1800",
},
body: icsContent,
};
} catch (error) {
logger.error("Error generating calendar", {
error: { message: error instanceof Error ? error.message : String(error) },
});
return {
statusCode: 500,
headers: {
"Content-Type": "text/plain",
"Cache-Control": "public, max-age=3600, s-maxage=3600",
},
body: "Es gab ein Problem beim Erzeugen des Kalenders",
};
} finally {
logger.resetKeys();
}
};

export const handler = Sentry.wrapHandler(
middy(lambdaHandler)
.use(captureLambdaHandler(tracer, { captureResponse: false }))
.use(injectLambdaContext(logger)),
);
