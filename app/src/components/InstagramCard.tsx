import { Card, CardSection, Grid, GridCol, Image, Stack, Text } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { BeholdPost } from "@/lambda/social/types";

export default function InstagramCard(post: BeholdPost) {
	const [isHovered, setIsHovered] = useState(false);
	const [videoLoaded, setVideoLoaded] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);

	const { id, prunedCaption, sizes, permalink, hashtags, mediaType, mediaUrl } = post;

	const isVideo = mediaType === "VIDEO";

	const handleMouseEnter = () => {
		setIsHovered(true);
		if (videoRef.current && videoLoaded) {
			videoRef.current.play().catch(() => {});
		}
	};

	const handleVideoClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (videoRef.current?.paused) {
			videoRef.current.play();
		}
	};

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (!isHovered && !video.paused) {
			video.pause();
			video.currentTime = 0;
		}
	}, [isHovered]);

	return (
		<Card
			component="a"
			href={permalink}
			target="_blank"
			rel="noopener noreferrer"
			radius="md"
			shadow="sm"
			h={180}
			style={{ overflow: "hidden" }}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={() => setIsHovered(false)}
			data-post-id={id}
		>
			<CardSection h="100%">
				<Grid justify="space-between" align="stretch" gutter={0} h="100%">
					<GridCol span={4} pos="relative" style={{ overflow: "hidden", display: "flex", alignItems: "center" }}>
						{isVideo && (
							<video
								ref={videoRef}
								src={mediaUrl}
								height="100%"
								width="100%"
								muted
								loop
								playsInline
								poster={sizes.small.mediaUrl}
								controls={false}
								onClick={handleVideoClick}
								onLoadedData={() => setVideoLoaded(true)}
								onError={() => setVideoLoaded(false)}
								preload="auto"
								style={{
									position: "absolute",
									top: 0,
									bottom: 0,
									left: 0,
									right: 0,
									zIndex: 1,
									objectFit: "cover",
									opacity: isHovered && videoLoaded ? 1 : 0,
									transition: "opacity 0.5s ease",
									cursor: "pointer",
								}}
							/>
						)}
						<Image
							src={sizes.small.mediaUrl}
							alt={""}
							style={{
								width: "100%",
								height: "100%",
								objectFit: "cover",
								transition: "transform 0.5s ease",
								transform: isHovered ? "scale(1.03)" : undefined,
								position: "relative",
								zIndex: 0,
							}}
						/>
					</GridCol>
					<GridCol span={8} style={{ overflow: "hidden" }}>
						<Stack justify="space-between" p="sm">
							<Text lineClamp={6}>{prunedCaption}</Text>
							{hashtags.length > 0 && (
								<Text size="xs" fw="bold">
									{hashtags.map((h) => `#${h}`).join(" ")}
								</Text>
							)}
						</Stack>
					</GridCol>
				</Grid>
			</CardSection>
		</Card>
	);
}
