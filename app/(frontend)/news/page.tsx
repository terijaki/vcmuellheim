import NewsCard from "@/components/NewsCard";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { getNews } from "@/data/news";
import { Center, Container, SimpleGrid, Stack } from "@mantine/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import Paginator from "./Paginator";

export const metadata: Metadata = { title: "News" };

export default async function NewsListPage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	// read search params, then query the news
	const { page = 1 } = await searchParams;
	// verify if page is a number, if not set to 1
	const parsedPage = typeof page === "string" && !Number.isNaN(Number(page)) ? Number(page) : 1;
	const data = await getNews(24, parsedPage);
	const events = data?.docs;

	return (
		<PageWithHeading title={"Neuigkeiten des Volleyballclub Müllheim"}>
			<Suspense fallback={"Lade News..."}>
				<Container size="xl">
					<Stack>
						<SimpleGrid cols={{ base: 1, sm: 2 }}>
							{events?.map((post) => {
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
						{data?.totalPages && (
							<Center py="xl">
								<Paginator total={data.totalPages} value={parsedPage} />
							</Center>
						)}
					</Stack>
				</Container>
			</Suspense>
		</PageWithHeading>
	);
}
