"use client";
import { Box, Card, CardSection, Space, Text, Title } from "@mantine/core";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

interface NewsCardProps {
	id: string;
	title: string;
	excerpt: string;
	thumbnails?: string[];
}

export default function NewsCard(props: NewsCardProps) {
	const [isHovered, setIsHovered] = useState(false);

	// check if this post has a thumbnail
	const thumbnail = useMemo(() => {
		if (!props.thumbnails || props.thumbnails.length === 0) {
			return undefined;
		}
		// if there are multiple thumbnails, pick a random one and memorize it
		if (props.thumbnails.length > 1) {
			const randomIndex = Math.floor(Math.random() * props.thumbnails.length);
			return props.thumbnails[randomIndex];
		}
		return props.thumbnails[0];
	}, [props.thumbnails]);

	return (
		<Card component={Link} href={`/news/${props.id}`} prefetch radius="md" shadow="sm" maw={{ base: "100%", sm: 620 }} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
			<CardSection bg={thumbnail ? "lion" : undefined} mb="xs">
				{thumbnail ? (
					<Box pt="xl" style={{ overflow: "hidden" }} pos="relative">
						<Box style={{ zIndex: 2 }} pos="relative">
							<Space h="xl" />
							<Space h="xl" />
							<Title order={4} fw="bold" px="sm" py="xs" c="white" lineClamp={2} style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}>
								{props.title}
							</Title>
						</Box>
						<Image
							src={thumbnail}
							fill
							quality={70}
							sizes="(max-width: 400px) 370px, (max-width: 700px) 580px, 700px"
							style={{
								objectFit: "cover",
								transition: "transform 0.5s ease",
								transform: isHovered ? "scale(1.03)" : undefined,
								zIndex: 1,
								aspectRatio: "700/142",
								height: 142,
								maxWidth: 700,
							}}
							alt={props.title}
						/>
					</Box>
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
