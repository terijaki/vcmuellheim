import { Card, CardSection, Image, Stack, Text } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import type { BeholdPost } from "@/lambda/social/types";

export default function InstagramCard(post: BeholdPost) {
	const [isHovered, setIsHovered] = useState(false);
	const [videoLoaded, setVideoLoaded] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);

	const { id, prunedCaption, sizes, permalink, hashtags, mediaType, mediaUrl, altText } = post;

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
			mah={180}
			orientation="horizontal"
			onMouseEnter={handleMouseEnter}
			onMouseLeave={() => setIsHovered(false)}
			data-post-id={id}
		>
			<CardSection w={180} style={{ overflow: "hidden" }}>
				{isVideo && (
					<video
						ref={videoRef}
						src={mediaUrl}
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
					alt={altText || ""}
					h="100%"
					fit="cover"
					style={{
						transition: "transform 0.5s ease",
						transform: isHovered ? "scale(1.03)" : undefined,
					}}
				/>
			</CardSection>
			<Stack justify="space-between" h="100%" p="sm" style={{ flex: 1, overflow: "hidden" }}>
				<Text lineClamp={6}>{prunedCaption}</Text>
				{hashtags.length > 0 && (
					<Text size="xs" fw="bold">
						{hashtags.map((h) => `#${h}`).join(" ")}
					</Text>
				)}
			</Stack>
		</Card>
	);
}
