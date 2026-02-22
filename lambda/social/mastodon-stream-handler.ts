/**
 * DynamoDB Stream handler for news table changes
 * Triggers Mastodon sharing when a news article is published
 */

import { Logger } from "@aws-lambda-powertools/logger";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamEvent } from "aws-lambda";
import { docClient } from "@/lib/db/client";
import type { News } from "@/lib/db/types";

const logger = new Logger({ serviceName: "mastodon-stream-handler" });
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
	logger.info("Processing DynamoDB stream event", { recordCount: event.Records.length });

	// Only process in production
	if (ENVIRONMENT !== "prod") {
		logger.info("Skipping Mastodon sharing - not in production environment");
		return;
	}

	if (!MASTODON_LAMBDA_NAME || !WEBSITE_URL || !NEWS_TABLE_NAME) {
		logger.warn("Missing required environment variables for Mastodon sharing");
		return;
	}

	for (const record of event.Records) {
		try {
			const newImage = record.dynamodb?.NewImage;

			if (!newImage) {
				logger.info("Skipping record - missing new image");
				continue;
			}

			// Unmarshall new DynamoDB record
			const newNews = unmarshall(newImage as Record<string, AttributeValue>) as News;
			const notYetShared = !newNews.sharedToMastodon;

			// Check if this is a news article being published
			let isBeingPublished = false;

			if (record.eventName === "MODIFY") {
				// Status transition to published (e.g., draft → published, archived → published)
				const oldImage = record.dynamodb?.OldImage;
				if (oldImage) {
					const oldNews = unmarshall(oldImage as Record<string, AttributeValue>) as News;
					isBeingPublished = oldNews.status !== "published" && newNews.status === "published";
				}
			} else if (record.eventName === "INSERT") {
				// New article created directly with published status
				isBeingPublished = newNews.status === "published";
			}

			if (isBeingPublished && notYetShared) {
				logger.info("News article being published - triggering Mastodon share", {
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

				logger.info("Mastodon share triggered successfully");

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

				logger.info("News article marked as shared to Mastodon");
			}
		} catch (error) {
			logger.error("Error processing stream record", { error });
			// Don't throw - we want to continue processing other records
		}
	}

	logger.info("Finished processing DynamoDB stream event");
}
