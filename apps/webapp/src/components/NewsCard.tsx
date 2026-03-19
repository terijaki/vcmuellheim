import { Box, CardSection, Stack, Text, Title } from "@mantine/core";
import { forwardRef, useMemo, useState } from "react";
import type { News } from "@/lib/db/types";
import { useFileUrl } from "../hooks/dataQueries";
import { CardLink } from "./CustomLink";
import ResponsiveImage from "./ResponsiveImage";

const CARD_HEIGHT = 140;

/** To ensure that the same image is shown for the same news item across different renders, we use a stable hashing function to select an image from the available ones based on the news item's ID. This way, even if there are multiple images, the same one will be consistently chosen for each news item. */
const stableIndexFromId = (id: string, length: number) => {
	let hash = 0;
	for (let i = 0; i < id.length; i += 1) {
		hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
	}
	return hash % length;
};

const NewsCard = forwardRef<HTMLAnchorElement, News>((props, ref) => {
	const hasImage = props.imageS3Keys && props.imageS3Keys.length > 0;

	const thumbnailKey = useMemo(() => {
		if (!props.imageS3Keys || props.imageS3Keys.length === 0) {
			return undefined;
		}
		if (props.imageS3Keys.length === 1) {
			return props.imageS3Keys[0];
		}
		const deterministicIndex = stableIndexFromId(props.id, props.imageS3Keys.length);
		return props.imageS3Keys[deterministicIndex];
	}, [props.id, props.imageS3Keys]);

	const { data: thumbnail } = useFileUrl(thumbnailKey);

	const [isHovered, setIsHovered] = useState(false);
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
			<CardSection bg={hasImage && thumbnail ? "lion" : undefined} mb="xs">
				{thumbnail ? (
					<Box style={{ position: "relative", height: CARD_HEIGHT, overflow: "hidden" }}>
						<ResponsiveImage
							source={thumbnail}
							alt={`Galleryfoto`}
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
