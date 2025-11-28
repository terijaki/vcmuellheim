import { Button, Center, Container, SimpleGrid, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Suspense } from "react";
import { useNews } from "../../lib/hooks";
import SectionHeading from "../layout/SectionHeading";
import NewsCard from "../NewsCard";
import ScrollAnchor from "./ScrollAnchor";

export default function HomeNews() {
	const { data } = useNews(); // FIXME: introduce limit in the hook
	let news = data?.items;

	// if the 3 and 4th news are older than 3 months, exclude them
	if (news && news.length > 2) {
		const threeMonthsAgo = dayjs().subtract(3, "month");
		const thirdIsOld = dayjs(news[2].publishedDate).isBefore(threeMonthsAgo);
		if (thirdIsOld) news = news.slice(0, 2);
	}

	return (
		<Container size="xl" py="md" px={{ base: "lg", md: "xl" }}>
			<ScrollAnchor name="news" />
			<Stack>
				<SectionHeading text="News" />
				<Suspense fallback={<Text>Lade Newsbeiträge</Text>}>
					<SimpleGrid cols={{ base: 1, sm: 2 }}>
						{news?.map((post) => {
							return <NewsCard key={post.id} {...post} />;
						})}
					</SimpleGrid>
					<Center p="md">
						<Button component={Link} to="/news">
							News-Archiv
						</Button>
					</Center>
				</Suspense>
			</Stack>
		</Container>
	);
}
