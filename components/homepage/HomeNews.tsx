import SectionHeading from "@/components/layout/SectionHeading";
import { getNews } from "@/data/news";
import { Button, Center, Container, SimpleGrid, Stack, Text } from "@mantine/core";
import dayjs from "dayjs";
import { unstable_cacheLife as cacheLife, unstable_cacheTag as cacheTag } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import NewsCard from "../NewsCard";
import ScrollAnchor from "./ScrollAnchor";

export default async function HomeNews() {
	"use cache";
	cacheLife("minutes");
	cacheTag("news");

	const newsData = await getNews(4, undefined);
	let news = newsData?.docs;

	// if the 3 and 4th news are older than 3 months, exclude them
	if (news && news.length > 2) {
		const threeMonthsAgo = dayjs().subtract(3, "month");
		const thirdIsOld = dayjs(news[2].publishedDate).isBefore(threeMonthsAgo);
		if (thirdIsOld) news = news.splice(2, 2);
	}

	return (
		<Container size="xl" py="md" px={{ base: "lg", md: "xl" }}>
			<ScrollAnchor name="news" />
			<Stack>
				<SectionHeading text="News" />
				<Suspense fallback={<Text>Lade Newsbeiträge</Text>}>
					<SimpleGrid cols={{ base: 1, sm: 2 }}>
						{news?.map((post) => {
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
			</Stack>
		</Container>
	);
}
