import { Center, Container, SimpleGrid, Stack } from "@mantine/core";
import type { Metadata } from "next";
import { unstable_cacheTag as cacheTag } from "next/cache";
import { Suspense } from "react";
import CenteredLoader from "@/components/CenteredLoader";
import PageWithHeading from "@/components/layout/PageWithHeading";
import NewsCard from "@/components/NewsCard";
import Paginator from "@/components/Paginator";
import { getNews } from "@/data/news";

export const metadata: Metadata = { title: "News" };

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
	// read search params to know which page to fetch
	const { page = 1 } = await searchParams;
	// verify if page is a number, if not set to 1
	const parsedPage = typeof page === "string" && !Number.isNaN(Number(page)) ? Number(page) : 1;

	return (
		<PageWithHeading title={"News Beiträge"}>
			<Suspense fallback={<CenteredLoader text="Lade Beiträge..." />}>
				<NewsGrid page={parsedPage} />
			</Suspense>
		</PageWithHeading>
	);
}

async function NewsGrid({ page }: { page: number }) {
	"use cache";
	cacheTag("news");

	const data = await getNews(24, page);
	const events = data?.docs;

	return (
		<Container size="xl">
			<Stack>
				<SimpleGrid cols={{ base: 1, sm: 2 }}>
					{events?.map((post) => {
						// filter out the thumbnail urls
						const thumbnails = post.images?.map((i) => (typeof i === "string" ? i : i.url)).filter((i) => typeof i === "string");
						return <NewsCard key={post.id} id={post.id} title={post.title} thumbnails={thumbnails} excerpt={post.excerpt || ""} />;
					})}
				</SimpleGrid>
				{data?.totalPages && (
					<Center py="xl">
						<Paginator total={data.totalPages} value={page} />
					</Center>
				)}
			</Stack>
		</Container>
	);
}
