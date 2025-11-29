import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import dayjs from "dayjs";
import type { InstagramPost } from "./types";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.INSTAGRAM_TABLE_NAME;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
	console.log("📸 Instagram posts request", { path: event.path, queryParams: event.queryStringParameters });

	if (!TABLE_NAME) {
		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ error: "INSTAGRAM_TABLE_NAME environment variable is not set" }),
		};
	}

	try {
		const { handle, days } = event.queryStringParameters || {};
		const daysToQuery = days ? Number.parseInt(days, 10) : 7; // Default to 7 days

		let posts: InstagramPost[];

		if (handle) {
			// Query posts by specific handle using GSI
			posts = await getPostsByHandle(handle, daysToQuery);
		} else {
			// Get all recent posts using entityType GSI
			posts = await getRecentPosts(daysToQuery);
		}

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
				"Cache-Control": "public, max-age=3600, s-maxage=3600", // 1 hour cache
			},
			body: JSON.stringify({
				posts,
				count: posts.length,
			}),
		};
	} catch (error) {
		console.error("❌ Error fetching Instagram posts:", error);

		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: "Failed to fetch Instagram posts",
				message: error instanceof Error ? error.message : "Unknown error",
			}),
		};
	}
};

/**
 * Get recent posts from all handles using the main table
 */
async function getRecentPosts(days: number): Promise<InstagramPost[]> {
	const cutoffDate = dayjs().subtract(days, "day").toISOString();

	const command = new QueryCommand({
		TableName: TABLE_NAME,
		KeyConditionExpression: "entityType = :entityType AND #ts >= :cutoffDate",
		ExpressionAttributeValues: {
			":entityType": "POST",
			":cutoffDate": cutoffDate,
		},
		ExpressionAttributeNames: {
			"#ts": "timestamp", // "timestamp" is a DynamoDB reserved word
			"#type": "type", // "type" is a DynamoDB reserved word
			"#url": "url", // "url" is a DynamoDB reserved word
		},
		ProjectionExpression: "id, #ts, #type, #url, ownerFullName, ownerUsername, inputUrl, caption, displayUrl, videoUrl, dimensionsHeight, dimensionsWidth, images, likesCount, commentsCount, hashtags",
		ScanIndexForward: false, // Return newest posts first
	});

	const result = await docClient.send(command);
	return (result.Items || []) as InstagramPost[];
}

/**
 * Get Instagram posts by handle - query all recent posts then filter in-memory
 */
async function getPostsByHandle(handle: string, days: number): Promise<InstagramPost[]> {
	// Get all recent posts
	const allPosts = await getRecentPosts(days);

	// Filter by handle in-memory (efficient for small datasets)
	return allPosts.filter((post) => post.ownerUsername.toLowerCase() === handle.toLowerCase());
}
