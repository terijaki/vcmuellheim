import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { type ClubLogoQueryParams, ClubLogoQueryParamsSchema, type ClubResponse, ClubResponseSchema } from "./types";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const CLUBS_TABLE_NAME = process.env.CLUBS_TABLE_NAME;

// 90 days in seconds
const CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;

// Helper function to fetch club by UUID
async function fetchClubByUuid(clubUuid: string): Promise<ClubResponse | null> {
	console.log(`🔍 Fetching club: ${clubUuid}`);
	const clubById = await docClient.send(
		new GetCommand({
			TableName: CLUBS_TABLE_NAME,
			Key: {
				sportsclubUuid: clubUuid,
			},
		}),
	);
	return clubById.Item ? ClubResponseSchema.parse(clubById.Item) : null;
}

// Helper function to fetch club by slug
async function fetchClubBySlug(clubSlug: string): Promise<ClubResponse | null> {
	console.log(`🔍 Fetching club by slug: ${clubSlug}`);
	const clubBySlug = await docClient.send(
		new QueryCommand({
			TableName: CLUBS_TABLE_NAME,
			IndexName: "GSI-SamsClubQueries",
			KeyConditionExpression: "#type = :type AND begins_with(#nameSlug, :nameSlug)",
			ExpressionAttributeNames: {
				"#type": "type",
				"#nameSlug": "nameSlug",
			},
			ExpressionAttributeValues: {
				":type": "club",
				":nameSlug": clubSlug,
			},
			Limit: 1,
		}),
	);
	return clubBySlug.Items && clubBySlug.Items.length > 0 ? ClubResponseSchema.parse(clubBySlug.Items[0]) : null;
}

// Helper function to create error response
function errorResponse(statusCode: number, error: string, cacheControl: string = "public, max-age=3600"): APIGatewayProxyResult {
	return {
		statusCode,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": cacheControl,
		},
		body: JSON.stringify({ error }),
	};
}

// Helper function to create success response
function successResponse(buffer: Buffer, contentType: string, resolvedIdentifier: string): APIGatewayProxyResult {
	return {
		statusCode: 200,
		headers: {
			"Content-Type": contentType,
			"Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}, immutable`,
			ETag: `"${resolvedIdentifier}-${buffer.length}"`,
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
		},
		body: buffer.toString("base64"),
		isBase64Encoded: true,
	};
}
// Helper function to create no content response
function noContentResponse(statusCode = 204): APIGatewayProxyResult {
	return {
		statusCode,
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": "public, max-age=86400",
		},
		body: JSON.stringify({ message: "No logo available for this club" }),
	};
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	console.log("📷 Logo proxy request", { path: event.path, queryStringParameters: event.queryStringParameters });

	// Parse and validate query parameters using schema
	const queryParams = event.queryStringParameters || {};
	const rawParams = {
		clubUuid: typeof queryParams.clubUuid === "string" ? queryParams.clubUuid : undefined,
		clubSlug: typeof queryParams.clubSlug === "string" ? queryParams.clubSlug : undefined,
	};

	// Validate against schema
	let params: ClubLogoQueryParams;
	try {
		params = ClubLogoQueryParamsSchema.parse(rawParams);
	} catch {
		return errorResponse(400, "Either 'clubUuid' or 'clubSlug' query parameter is required (e.g., /logos?clubUuid={uuid} or /logos?clubSlug={nameSlug})");
	}

	const { clubUuid, clubSlug } = params;

	// Accept either clubUuid (definitive identifier) or clubSlug (fuzzy identifier) query parameter
	const resolvedIdentifier = clubUuid || clubSlug;

	if (!resolvedIdentifier) {
		return errorResponse(400, "Either 'clubUuid' or 'clubSlug' query parameter is required (e.g., /logos?clubUuid={uuid} or /logos?clubSlug={nameSlug})");
	}

	if (!CLUBS_TABLE_NAME) {
		console.error("❌ Environment variables not set", { CLUBS_TABLE_NAME: !!CLUBS_TABLE_NAME });
		return errorResponse(500, "Internal server error: missing configuration");
	}

	let logoUrl: string = "";

	try {
		let club: ClubResponse | null = null;

		// Fetch club by UUID or slug
		if (clubUuid) {
			club = await fetchClubByUuid(clubUuid);
		} else if (clubSlug) {
			club = await fetchClubBySlug(clubSlug);
			if (!club) {
				return errorResponse(404, `⚠️  Club not found by slug: ${clubSlug}`, "public, max-age=259200");
			}
		}

		// Handle missing logo
		if (!club?.logoImageLink) {
			return noContentResponse();
		}

		logoUrl = club.logoImageLink;
		console.log(`📥 Downloading logo from: ${logoUrl}`);

		// Download image from external SAMS API with timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

		const imageResponse = await fetch(logoUrl, {
			signal: controller.signal,
			headers: {
				"User-Agent": "VCM Logo Proxy/1.0",
			},
		});

		clearTimeout(timeoutId);

		if (!imageResponse.ok) {
			console.error(`❌ Failed to download logo: ${imageResponse.statusText}`, {
				url: logoUrl,
				status: imageResponse.status,
			});
			return errorResponse(502, "Failed to fetch logo from upstream", "public, max-age=3600");
		}

		// Read image as buffer
		const arrayBuffer = await imageResponse.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Get content type from response, default to PNG
		const contentType = imageResponse.headers.get("content-type") || "image/png";

		console.log(`✅ Logo downloaded successfully`, {
			clubUuid,
			clubSlug,
			size: buffer.length,
			contentType,
		});

		return successResponse(buffer, contentType, resolvedIdentifier);
	} catch (error) {
		console.error("🚨 Logo proxy error:", error);

		// Determine if it's a timeout or other error
		const isTimeout = error instanceof Error && error.message.includes("timeout");
		const statusCode = isTimeout ? 504 : 500;
		const errorMessage = isTimeout ? "Logo fetch timeout" : "Internal server error";

		return errorResponse(statusCode, errorMessage);
	}
};
