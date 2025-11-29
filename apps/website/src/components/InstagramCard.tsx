import { Card, CardSection, Grid, GridCol, Group, Image, Stack, Text } from "@mantine/core";
import { useInViewport } from "@mantine/hooks";
import { useEffect, useRef, useState } from "react";
import { FaComment as IconComment, FaHeart as IconLike } from "react-icons/fa6";
import type { InstagramPost } from "@/lambda/social/types";

export default function InstagramCard(post: InstagramPost) {
	const [isHovered, setIsHovered] = useState(false);
	const { ref } = useInViewport();
	const [videoLoaded, setVideoLoaded] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);

	const {
		id,
		caption,
		likesCount,
		commentsCount,
		url,
		displayUrl,
		// dimensionsHeight,
		// dimensionsWidth,
		ownerUsername,
		hashtags,
		videoUrl,
	} = post;

	const shouldShowVideo = isHovered;

	// Handle video playback on hover with user interaction requirement
	const handleMouseEnter = () => {
		setIsHovered(true);
		// Try to play immediately on hover
		if (videoRef.current && videoLoaded) {
			videoRef.current.play().catch(() => {
				// If autoplay fails, it will play on click instead
			});
		}
	};

	const handleVideoClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (videoRef.current) {
			if (videoRef.current.paused) {
				videoRef.current.play();
			}
		}
	};

	// Handle video playback state
	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;

		if (!shouldShowVideo && !video.paused) {
			video.pause();
			video.currentTime = 0;
		}
	}, [shouldShowVideo]);

	// Debug logging
	useEffect(() => {
		if (videoUrl && isHovered) {
			console.log("Video state on hover:", {
				id,
				videoLoaded,
				shouldShowVideo,
				isHovered,
			});
		}
	}, [videoUrl, videoLoaded, shouldShowVideo, isHovered, id]);

	// fetch data dynamicallys based on instagram url in our teams

	return (
		<Card
			ref={ref}
			component="a"
			href={url || ""}
			target="_blank"
			rel="noopener noreferrer"
			radius="md"
			shadow="sm"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={() => setIsHovered(false)}
			data-post-id={id}
		>
			<CardSection ref={ref}>
				<Grid justify="space-between" align="stretch" gutter={0}>
					<GridCol span={4} pos="relative" style={{ overflow: "hidden" }}>
						{videoUrl && (
							<video
								ref={videoRef}
								src={videoUrl}
								height="100%"
								width="100%"
								muted
								loop
								playsInline
								poster={displayUrl}
								controls={false}
								onClick={handleVideoClick}
								onLoadedData={() => {
									console.log("Video loaded successfully:", videoUrl);
									setVideoLoaded(true);
								}}
								onError={(e) => {
									console.error("Video failed to load:", videoUrl, e);
									setVideoLoaded(false);
								}}
								onCanPlay={() => {
									console.log("Video can play:", videoUrl);
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
									opacity: shouldShowVideo && videoLoaded ? 1 : 0,
									transition: "opacity 0.5s ease",
									cursor: "pointer",
								}}
							/>
						)}
						<Image
							src={displayUrl}
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
					<GridCol span={8}>
						<Stack justify="space-between" p="sm">
							<Text lineClamp={6}>{caption}</Text>
							{hashtags && hashtags.length > 0 && (
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
