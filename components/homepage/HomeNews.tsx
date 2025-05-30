import SectionHeading from "@/components/layout/SectionHeading";
import { getNews } from "@/data/news";
import { Button, Center, Container, SimpleGrid, Stack, Text } from "@mantine/core";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import NewsCard from "../NewsCard";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeNews() {
	"use cache";
	cacheLife("minutes");

	const data = await getNews(4, undefined);

	return (
		<Container size="xl" py="md">
			<ScrollAnchor name="news" />
			<Stack>
				<SectionHeading text="News" />
				<Suspense fallback={<Text>Lade Newsbeiträge</Text>}>
					<SimpleGrid cols={{ base: 1, sm: 2 }}>
						{data?.docs.map((post) => {
							// filter out the thumbnail urls
							const thumbnails = post.images
								?.map((i) => (typeof i === "string" ? i : i.url))
								.filter((i) => typeof i === "string");
							return (
								<NewsCard
									key={post.id}
									id={post.id}
									title={post.title}
									thumbnails={thumbnails}
									excerpt={post.excerpt || ""}
								/>
							);
						})}
					</SimpleGrid>
					<Center p="md">
						<Button component={Link} href="/news">
							alle Newsbeiträge
						</Button>
					</Center>
				</Suspense>
			</Stack>
		</Container>
	);
}
