import NewsCard from "@/components/NewsCard";
import PageWithHeading from "@/components/layout/PageWithHeading";
import { getNews } from "@/data/news";
import { Container, SimpleGrid } from "@mantine/core";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

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
	const data = await getNews(undefined, parsedPage);
	const events = data?.docs;

	return (
		<PageWithHeading title={"Neuigkeiten des Volleyballclub Müllheim"}>
			<Suspense fallback={"Lade News..."}>
				<Container size="xl">
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
					{data && <Paginator total={data.totalPages} current={data.page || 1} />}
				</Container>
			</Suspense>
		</PageWithHeading>
	);
}

function Paginator({ total, current }: { total: number; current: number }) {
	const displayedPages = [1, total, current];
	let currentOffsetMinusTwo: React.ReactNode;
	let currentOffsetMinusOne: React.ReactNode;
	let currentOffsetPlusOne: React.ReactNode;
	let currentOffsetPlusTwo: React.ReactNode;
	if (!displayedPages.includes(Math.max(1, current - 1))) {
		const page = current - 1;
		currentOffsetMinusOne = <Link href={`?page=${page.toString()}`}>{page}</Link>;
	}
	if (!displayedPages.includes(Math.max(1, current - 2))) {
		const page = current - 2;
		currentOffsetMinusTwo = <Link href={`?page=${page.toString()}`}>{page}</Link>;
	}
	if (!displayedPages.includes(Math.min(total, current + 1))) {
		const page = current + 1;
		currentOffsetPlusOne = <Link href={`?page=${page.toString()}`}>{page}</Link>;
	}
	if (!displayedPages.includes(Math.min(total, current + 2))) {
		const page = current + 2;
		currentOffsetPlusTwo = <Link href={`?page=${page.toString()}`}>{page}</Link>;
	}
	return (
		<div className="col-center-content py-3 flex justify-center mb-3">
			<div className="text-oynx grid grid-flow-col border border-onyx divide-x divide-onyx rounded prose-a:py-1 prose-a:px-3 prose-p:px-2 prose-p:m-0 prose-a:text-onyx hover:prose-a:bg-blumine hover:prose-p:bg-blumine hover:prose-a:text-white hover:prose-p:text-white">
				{current > 1 && <Link href="1">1</Link>}
				{current > 4 && <p>...</p>}
				{currentOffsetMinusTwo}
				{currentOffsetMinusOne}
				<Link href={current.toString()} className="!bg-onyx !text-white">
					{current.toString()}
				</Link>
				{currentOffsetPlusOne}
				{currentOffsetPlusTwo}
				{current < total - 3 && <p>...</p>}
				{current < total && <Link href={`?page=${total.toString()}`}>{total}</Link>}
			</div>
		</div>
	);
}
