import { BackgroundImage, Card, CardSection, Space, Text, Title } from "@mantine/core";
import Link from "next/link";

interface NewsCardProps {
	id: string;
	title: string;
	excerpt: string;
	thumbnails?: string[];
}

export default function NewsCard(props: NewsCardProps) {
	// check if this post has a thumbnail
	let thumbnail = props.thumbnails ? props.thumbnails[0] : undefined;

	if (thumbnail) {
		// if there are multiple thumbnails, pick a random one
		if (props.thumbnails && props.thumbnails.length > 1) {
			const randomIndex = Math.floor(Math.random() * props.thumbnails.length);
			thumbnail = props.thumbnails[randomIndex];
		}
	}

	return (
		<Card component={Link} href={`/news/${props.id}`} prefetch shadow="sm" radius="md" maw={{ base: "100%", sm: 620 }}>
			<CardSection bg={thumbnail ? "lion" : undefined} mb="xs">
				{thumbnail ? (
					<BackgroundImage src={thumbnail} pt="xl">
						<Space h="xl" />
						<Space h="xl" />
						<Title
							order={4}
							fw="bold"
							px="sm"
							py="xs"
							c="white"
							lineClamp={2}
							style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
						>
							{props.title}
						</Title>
					</BackgroundImage>
				) : (
					<Title order={4} fw="bold" p="sm">
						{props.title}
					</Title>
				)}
			</CardSection>
			<Text lineClamp={thumbnail ? 2 : 6}>{props.excerpt}</Text>
		</Card>
	);
}
