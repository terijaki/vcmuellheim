import { Logger } from "@aws-lambda-powertools/logger";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import middy from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { generateIcsCalendar, type IcsCalendar, type IcsEvent } from "ts-ics";
import type { Event } from "@/lib/db/types";
import { Club } from "@/project.config";

dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

const SAMS_API_URL = process.env.SAMS_API_URL || "";
const TEAMS_TABLE_NAME = process.env.TEAMS_TABLE_NAME || "";
const EVENTS_TABLE_NAME = process.env.EVENTS_TABLE_NAME || "";

// Initialize Logger and Tracer outside handler for reuse across invocations
const logger = new Logger({
	serviceName: "vcm-ics-calendar",
	logLevel: (process.env.LOG_LEVEL || "INFO") as "DEBUG" | "INFO" | "WARN" | "ERROR",
});

const tracer = new Tracer({
	serviceName: "vcm-ics-calendar",
	enabled: process.env.POWERTOOLS_TRACE_ENABLED !== "false",
});

// Create DynamoDB client and trace it
const dynamoClient = new DynamoDBClient({});
tracer.captureAWSv3Client(dynamoClient);
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Fetch custom events from DynamoDB
 * Includes events from the past 14 days up to future events
 * Optionally filter by teamId if provided
 */
async function fetchCustomEvents(teamId?: string): Promise<Event[]> {
	// Include events from the past 14 days
	const fourteenDaysAgo = dayjs().subtract(14, "day").toISOString();

	// Build filter expression for team-specific events if needed
	let filterExpression: string | undefined;
	const expressionAttributeValues: Record<string, unknown> = {
		":type": "event",
		":fourteenDaysAgo": fourteenDaysAgo,
	};

	if (teamId) {
		filterExpression = "contains(teamIds, :teamId)";
		expressionAttributeValues[":teamId"] = teamId;
	}

	const result = await docClient.send(
		new QueryCommand({
			TableName: EVENTS_TABLE_NAME,
			IndexName: "GSI-EventQueries",
			KeyConditionExpression: "#type = :type AND #startDate >= :fourteenDaysAgo",
			ExpressionAttributeNames: {
				"#type": "type",
				"#startDate": "startDate",
			},
			ExpressionAttributeValues: expressionAttributeValues,
			FilterExpression: filterExpression,
			ScanIndexForward: true, // Ascending order
		}),
	);

	return (result.Items as Event[]) || [];
}

/**
 * Convert a custom event to ICS format
 */
function convertEventToIcs(event: Event, timestamp: Date): IcsEvent {
	const startTime = dayjs(event.startDate);
	const endTime = event.endDate ? dayjs(event.endDate) : undefined;

	// Calculate duration if endDate is provided, otherwise default to 2 hours
	let duration: { hours: number; minutes?: number } | { minutes: number } | undefined;
	if (endTime?.isValid()) {
		const durationMinutes = endTime.diff(startTime, "minute");
		// Ensure duration is positive
		if (durationMinutes > 0) {
			if (durationMinutes >= 60) {
				const hours = Math.floor(durationMinutes / 60);
				const remainingMinutes = durationMinutes % 60;
				duration = remainingMinutes > 0 ? { hours, minutes: remainingMinutes } : { hours };
			} else {
				duration = { minutes: durationMinutes };
			}
		} else {
			// If endDate is before startDate, default to 2 hours
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
	});

	try {
		// Get team slug from path parameters
		const teamSlug = event.pathParameters?.teamSlug?.replace(".ics", "").toLowerCase();

		let teamSamsUuid: string | undefined;
		let teamId: string | undefined;
		let teamLeagueName: string | undefined;
		let calendarTitle: string = Club.shortName;

		if (!teamSlug || teamSlug === "all") {
			// Get all club matches
			calendarTitle = `${calendarTitle} - Vereinskalender`;
		} else {
			// Find team by slug
			const result = await docClient.send(
				new QueryCommand({
					TableName: TEAMS_TABLE_NAME,
					IndexName: "GSI-TeamQueries",
					KeyConditionExpression: "#type = :type AND #slug = :slug",
					ExpressionAttributeNames: {
						"#type": "type",
						"#slug": "slug",
					},
					ExpressionAttributeValues: {
						":type": "team",
						":slug": teamSlug,
					},
					Limit: 1,
				}),
			);

			const foundTeam = result.Items?.[0];
			if (!foundTeam) {
				return {
					statusCode: 404,
					headers: {
						"Content-Type": "text/plain",
						"Cache-Control": "public, max-age=3600",
					},
					body: "Team nicht gefunden",
				};
			}

			if (foundTeam.name) calendarTitle = `${calendarTitle} - ${foundTeam.name}`;
			if (foundTeam.league) teamLeagueName = foundTeam.league;
			teamSamsUuid = foundTeam.sbvvTeamId;
			teamId = foundTeam.id;
		}

		// Fetch matches from SAMS API
		const queryParams: string[] = [];
		if (teamSamsUuid) queryParams.push(`team=${teamSamsUuid}`);
		const queryString = queryParams.length > 0 ? `?${queryParams.join("&")}` : "";

		const response = await fetch(`${SAMS_API_URL}/matches${queryString}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch matches: ${response.statusText}`);
		}

		const data = await response.json();
		const matches = data.matches || [];
		const timestamp = new Date(data.timestamp || new Date());

		// Convert matches to iCalendar events
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

					const teams = [];
					const team1 = match._embedded?.team1;
					const team2 = match._embedded?.team2;
					if (team1) teams.push(team1);
					if (team2) teams.push(team2);

					const homeTeam = teams.find((t) => t.uuid === match.host)?.name;
					const guestTeam = teams.find((t) => t.uuid !== match.host)?.name;
					const league = teamLeagueName;

					const location: string[] = [];
					if (match.location?.name) location.push(match.location.name);
					if (match.location?.address?.street) location.push(match.location.address.street);
					if (match.location?.address?.postcode || match.location?.address?.city) {
						const postalAndCity: string[] = [];
						if (match.location?.address?.postcode) postalAndCity.push(match.location.address.postcode);
						if (match.location?.address?.city) postalAndCity.push(match.location.address.city);
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
				},
			)
			.filter(Boolean);

		// Fetch custom events from DynamoDB (filtered by teamId if team-specific calendar)
		const customEvents = await fetchCustomEvents(teamId);
		const customIcsEvents = customEvents.map((evt) => convertEventToIcs(evt, timestamp));

		// Merge match events and custom events
		const events: IcsEvent[] = [...matchEvents, ...customIcsEvents];

		const icsCalendar: IcsCalendar = {
			prodId: Club.shortName,
			version: "2.0",
			events,
			name: calendarTitle,
		};

		// Generate ICS content
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

export const handler = middy(lambdaHandler)
	.use(captureLambdaHandler(tracer, { captureResponse: false }))
	.use(injectLambdaContext(logger));
