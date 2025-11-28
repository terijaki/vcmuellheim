import { BackgroundImage, Box, CardSection, Stack, Text, Title } from "@mantine/core";
import { forwardRef, useMemo, useState } from "react";
import type { News } from "@/lib/db";
import { useFileUrl } from "../lib/hooks";
import { CardLink } from "./CustomLink";

const CARD_HEIGHT = 140;

const NewsCard = forwardRef<HTMLAnchorElement, News>((props, ref) => {
	const [isHovered, setIsHovered] = useState(false);
	const hasImage = props.imageS3Keys && props.imageS3Keys.length > 0;

	const thumbnailKey = useMemo(() => {
		if (!props.imageS3Keys || props.imageS3Keys.length === 0) {
			return undefined;
		}
		if (props.imageS3Keys.length === 1) {
			return props.imageS3Keys[0];
		}
		const randomIndex = Math.floor(Math.random() * props.imageS3Keys.length);
		return props.imageS3Keys[randomIndex];
	}, [props.imageS3Keys]);

	const { data: thumbnail } = useFileUrl(thumbnailKey);

	return (
		<CardLink
			to={`/news/$id`}
			params={{ id: props.id }}
			radius="md"
			shadow="sm"
			maw={{ base: "100%", sm: 620 }}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			ref={ref}
		>
			<CardSection bg={hasImage ? "lion" : undefined} mb="xs">
				{thumbnail ? (
					<Box style={{ position: "relative", height: CARD_HEIGHT, overflow: "hidden" }}>
						<BackgroundImage
							src={thumbnail}
							style={{
								transition: "transform 0.5s ease",
								transform: isHovered ? "scale(1.03)" : undefined,
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: "100%",
								zIndex: 1,
							}}
						/>
						<Stack style={{ zIndex: 2, position: "relative", height: "100%" }} justify="flex-end" h={CARD_HEIGHT}>
							<Title order={4} fw="bold" px="sm" py="xs" c="white" lineClamp={2} style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
								{props.title}
							</Title>
						</Stack>
					</Box>
				) : (
					<Title order={4} fw="bold" p="sm">
						{props.title}
					</Title>
				)}
			</CardSection>
			<Text lineClamp={hasImage ? 2 : 6}>{props.excerpt}</Text>
		</CardLink>
	);
});

NewsCard.displayName = "NewsCard";

export default NewsCard;
