/**
 * Social media server functions — replaces the instagram-posts Lambda read endpoint.
 * Public, no auth required.
 */

import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { z } from "zod";
import { type InstagramPost, InstagramPostSchema } from "@/lambda/social/types";
import { docClient } from "@/lib/db/client";
import { parseServerArray } from "../schema-parse";

const INSTAGRAM_TABLE_NAME = () => process.env.INSTAGRAM_TABLE_NAME || "";
type SerializableValue = string | number | boolean | bigint | symbol | object;
type SerializableInstagramImage = Record<string, SerializableValue>;
type InstagramPostForServerFn = Omit<InstagramPost, "images"> & {
	images?: SerializableInstagramImage[];
};

function normalizeInstagramImages(images: InstagramPost["images"]): SerializableInstagramImage[] | undefined {
	if (!images) {
		return undefined;
	}

	return images.map((image) => {
		const normalizedImage: SerializableInstagramImage = {};

		for (const [key, value] of Object.entries(image)) {
			if (value !== null && value !== undefined) {
				normalizedImage[key] = value;
			}
		}

		return normalizedImage;
	});
}

export const getRecentInstagramPostsFn = createServerFn({ method: "GET" })
	.inputValidator(z.object({ days: z.number().int().min(1).max(90).optional() }))
	.handler(async ({ data }) => {
		const days = data?.days ?? 7;
		const cutoffDate = dayjs().subtract(days, "day").toISOString();

		const command = new QueryCommand({
			TableName: INSTAGRAM_TABLE_NAME(),
			IndexName: "entityType-timestamp-index",
			KeyConditionExpression: "entityType = :entityType AND #ts >= :cutoffDate",
			ExpressionAttributeValues: {
				":entityType": "POST",
				":cutoffDate": cutoffDate,
			},
			ExpressionAttributeNames: {
				"#ts": "timestamp",
				"#type": "type",
				"#url": "url",
			},
			ProjectionExpression:
				"id, #ts, #type, #url, ownerFullName, ownerUsername, inputUrl, caption, displayUrl, videoUrl, dimensionsHeight, dimensionsWidth, images, likesCount, commentsCount, hashtags",
			ScanIndexForward: false,
		});

		const result = await docClient.send(command);
		const items = result.Items || [];
		const posts = parseServerArray(InstagramPostSchema, items, "Failed to parse Instagram posts");

		return posts.map<InstagramPostForServerFn>((post) => ({
			...post,
			images: normalizeInstagramImages(post.images),
		}));
	});
