/**
 * DynamoDB Stream handler for news table changes
 * Triggers Mastodon sharing when a news article is published
 */

import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamEvent } from "aws-lambda";
import { docClient } from "@/lib/db/client";
import type { News } from "@/lib/db/types";

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || "eu-central-1" });
const MASTODON_LAMBDA_NAME = process.env.MASTODON_LAMBDA_NAME || "";
const ENVIRONMENT = process.env.ENVIRONMENT || "dev";
const WEBSITE_URL = process.env.WEBSITE_URL || "";
const NEWS_TABLE_NAME = process.env.NEWS_TABLE_NAME || "";

interface MastodonShareRequest {
	newsArticle: News;
	websiteUrl: string;
}

/**
 * Process DynamoDB stream records and trigger Mastodon sharing for newly published articles
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
	console.log("📥 Processing DynamoDB stream event", { recordCount: event.Records.length });

	// Only process in production
	if (ENVIRONMENT !== "prod") {
		console.log("⏭️ Skipping Mastodon sharing - not in production environment");
		return;
	}

	if (!MASTODON_LAMBDA_NAME || !WEBSITE_URL || !NEWS_TABLE_NAME) {
		console.warn("⚠️ Missing required environment variables for Mastodon sharing");
		return;
	}

	for (const record of event.Records) {
		try {
			// Only process MODIFY events (when a news article is updated)
			if (record.eventName !== "MODIFY") {
				continue;
			}

			// Get old and new images
			const oldImage = record.dynamodb?.OldImage;
			const newImage = record.dynamodb?.NewImage;

			if (!oldImage || !newImage) {
				console.log("⏭️ Skipping record - missing old or new image");
				continue;
			}

			// Unmarshall DynamoDB records to plain objects
			const oldNews = unmarshall(oldImage as Record<string, AttributeValue>) as News;
			const newNews = unmarshall(newImage as Record<string, AttributeValue>) as News;

			// Check if this is a news article being published
			const isBeingPublished = oldNews.status !== "published" && newNews.status === "published";
			const notYetShared = !newNews.sharedToMastodon;

			if (isBeingPublished && notYetShared) {
				console.log("📤 News article being published - triggering Mastodon share", {
					id: newNews.id,
					title: newNews.title,
					slug: newNews.slug,
				});

				// Prepare payload for Mastodon Lambda
				const payload: MastodonShareRequest = {
					newsArticle: newNews,
					websiteUrl: WEBSITE_URL,
				};

				// Invoke Mastodon Lambda asynchronously
				await lambdaClient.send(
					new InvokeCommand({
						FunctionName: MASTODON_LAMBDA_NAME,
						InvocationType: "Event", // Async invocation
						Payload: JSON.stringify(payload),
					}),
				);

				console.log("✅ Mastodon share triggered successfully");

				// Update the news article to mark it as shared
				await docClient.send(
					new UpdateCommand({
						TableName: NEWS_TABLE_NAME,
						Key: { id: newNews.id },
						UpdateExpression: "SET #sharedToMastodon = :true, #updatedAt = :updatedAt",
						ExpressionAttributeNames: {
							"#sharedToMastodon": "sharedToMastodon",
							"#updatedAt": "updatedAt",
						},
						ExpressionAttributeValues: {
							":true": true,
							":updatedAt": new Date().toISOString(),
						},
					}),
				);

				console.log("✅ News article marked as shared to Mastodon");
			}
		} catch (error) {
			console.error("❌ Error processing stream record:", error);
			// Don't throw - we want to continue processing other records
		}
	}

	console.log("✅ Finished processing DynamoDB stream event");
}
