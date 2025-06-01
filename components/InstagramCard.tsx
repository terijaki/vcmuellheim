"use client";
import type { InstagramPost } from "@/utils/social/instagram";
import { Card, CardSection, Grid, GridCol, Group, Stack, Text } from "@mantine/core";
import { useInViewport } from "@mantine/hooks";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FaComment as IconComment, FaHeart as IconLike } from "react-icons/fa6";

export default function InstagramCard(post: InstagramPost) {
	const [isHovered, setIsHovered] = useState(false);
	const { ref, inViewport } = useInViewport();
	const [playCount, setPlayCount] = useState(0);

	const {
		id,
		caption,
		likesCount,
		commentsCount,
		url,
		displayUrl,
		dimensionsHeight,
		dimensionsWidth,
		ownerUsername,
		hashtags,
		videoUrl,
	} = post;

	// fetch data dynamicalls based on instagram url in our teams

	return (
		<Card
			ref={ref}
			component={Link}
			href={url}
			target="_blank"
			radius="md"
			shadow="sm"
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			data-post-id={id}
		>
			<CardSection ref={ref}>
				<Grid justify="space-between" align="stretch" gutter={0}>
					<GridCol span={4} pos="relative" style={{ overflow: "hidden" }}>
						{videoUrl && (
							<video
								src={videoUrl}
								height="100%"
								width="100%"
								autoPlay
								muted
								loop
								playsInline
								poster={displayUrl}
								controls={false}
								onTimeUpdate={(e) => {
									const video = e.target as HTMLVideoElement;
									if (video.currentTime === 0 && playCount > 0) {
										setPlayCount(playCount + 1);
									} else if (video.currentTime > 0 && playCount === 0) {
										setPlayCount(1);
									}
								}}
								preload="auto"
								style={{
									position: "absolute",
									top: 0,
									bottom: 0,
									left: 0,
									right: 0,
									zIndex: 1,
									objectFit: "cover",
									opacity: playCount > 0 && (isHovered || (inViewport && playCount < 2)) ? 1 : 0,
									transition: "opacity 0.5s ease",
								}}
							/>
						)}
						<Image
							src={displayUrl}
							fill
							//  width={dimensionsWidth} height={dimensionsHeight}
							alt={""}
							style={{
								objectFit: "cover",
								transition: "transform 0.5s ease",
								transform: isHovered ? "scale(1.03)" : undefined,
							}}
						/>
					</GridCol>
					<GridCol span={8}>
						<Stack justify="space-between" p="sm">
							<Text lineClamp={6}>{caption}</Text>
							{hashtags?.length > 0 && (
								<Text size="xs" fw="bold">
									{hashtags.map((h) => `#${h}`).join(" ")}
								</Text>
							)}
							<Group c="dimmed">
								<Text size="xs">
									<IconLike /> {likesCount}
								</Text>
								<Text size="xs">
									<IconComment /> {commentsCount}
								</Text>
								<Text size="xs">＠ {ownerUsername}</Text>
							</Group>
						</Stack>
					</GridCol>
				</Grid>
			</CardSection>
		</Card>
	);
}
