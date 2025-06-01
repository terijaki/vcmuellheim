import SectionHeading from "@/components/layout/SectionHeading";
import { getNews } from "@/data/news";
import { getRecentInstagramPosts } from "@/utils/social/instagram";
import { Button, Center, Container, SimpleGrid, Stack, Text } from "@mantine/core";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import InstagramCard from "../InstagramCard";
import NewsCard from "../NewsCard";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeNews() {
	"use cache";
	cacheLife("minutes");

	const news = await getNews(4, undefined);

	const instagrams = await getRecentInstagramPosts();

	return (
		<Container size="xl" py="md">
			<ScrollAnchor name="news" />
			<Stack>
				<SectionHeading text="News" />
				<Suspense fallback={<Text>Lade Newsbeiträge</Text>}>
					<SimpleGrid cols={{ base: 1, sm: 2 }}>
						{news?.docs.map((post) => {
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
							News-Archiv
						</Button>
					</Center>
				</Suspense>
				<Suspense>
					<Stack>
						<SectionHeading text="Instagram" />
						<SimpleGrid cols={{ base: 1, md: 2 }}>
							{instagrams.map((post) => {
								return <InstagramCard key={post.id} {...post} />;
							})}
						</SimpleGrid>
					</Stack>
				</Suspense>
			</Stack>
		</Container>
	);
}
