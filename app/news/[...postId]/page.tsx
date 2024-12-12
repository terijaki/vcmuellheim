import NewsList from "@/app/components/homepage/NewsList";
import Link from "next/link";
import fs from "fs";
import { redirect } from "next/navigation";
import PageHeading from "@/app/components/layout/PageHeading";

const newsFolder = "data/posts";
const newsPerPage = 12;
const newsPostsTotal: number = newsCount();
const newsPagesTotal: number = newsPagesCount();

// generate a custom title
import { Metadata, ResolvingMetadata } from "next";
export async function generateMetadata({}, parent: ResolvingMetadata): Promise<Metadata> {
	return {
		title: "News",
	};
}

export async function generateStaticParams() {
	const toGenerate = Array.from(new Array(newsPagesTotal).keys()).map((x) => ++x);
	return toGenerate.map((news) => ({
		postId: [news.toString()],
	}));
}

export default async function newsDisplay(props: { params: Promise<{ postId?: string }> }) {
    const params = await props.params;
    // redirect if no valid page is targeted
    let newsPageId = Number(params.postId);
    if (!params.postId || newsPageId > newsPagesTotal || Number.isNaN(newsPageId)) {
		redirect("/news/1");
	}

    let newsPostStart: number = (newsPageId - 1) * newsPerPage + 1;
    let newsPostEnd: number = newsPageId * newsPerPage;
    return (
		<>
			<PageHeading title={"Neuigkeiten des Volleyballclub Müllheim"} />
			<div className="col-center-content mt-6 grid grid-cols-1 md:grid-cols-2 gap-5 py-3 flex-wrap">
				<NewsList
					pageStart={newsPostStart - 1}
					pageEnd={newsPostEnd}
				/>
			</div>
			{paginator(newsPageId)}
		</>
	);
}

function newsCount(): number {
	const number = Math.max(0, fs.readdirSync(newsFolder).length);
	return number;
}

function newsPagesCount(): number {
	const result = Number((newsCount() / newsPerPage).toFixed(0));
	return result;
}

function paginator(currentPage: number) {
	let displayedPages = [1, newsPagesTotal, currentPage];
	let currentOffsetMinusTwo;
	let currentOffsetMinusOne;
	let currentOffsetPlusOne;
	let currentOffsetPlusTwo;
	if (!displayedPages.includes(Math.max(1, currentPage - 1))) {
		let page = currentPage - 1;
		currentOffsetMinusOne = <Link href={page.toString()}>{page}</Link>;
	}
	if (!displayedPages.includes(Math.max(1, currentPage - 2))) {
		let page = currentPage - 2;
		currentOffsetMinusTwo = <Link href={page.toString()}>{page}</Link>;
	}
	if (!displayedPages.includes(Math.min(newsPagesTotal, currentPage + 1))) {
		let page = currentPage + 1;
		currentOffsetPlusOne = <Link href={page.toString()}>{page}</Link>;
	}
	if (!displayedPages.includes(Math.min(newsPagesTotal, currentPage + 2))) {
		let page = currentPage + 2;
		currentOffsetPlusTwo = <Link href={page.toString()}>{page}</Link>;
	}
	return (
		<div className="col-center-content py-3 flex justify-center mb-3">
			<div className="text-oynx grid grid-flow-col border border-onyx divide-x divide-onyx rounded prose-a:py-1 prose-a:px-3 prose-p:px-2 prose-p:m-0 prose-a:text-onyx hover:prose-a:bg-blumine hover:prose-p:bg-blumine hover:prose-a:text-white hover:prose-p:text-white">
				{currentPage > 1 && <Link href="1">1</Link>}
				{currentPage > 4 && <p>...</p>}
				{currentOffsetMinusTwo}
				{currentOffsetMinusOne}
				<Link
					href={currentPage.toString()}
					className="!bg-onyx !text-white"
				>
					{currentPage.toString()}
				</Link>
				{currentOffsetPlusOne}
				{currentOffsetPlusTwo}
				{currentPage < newsPagesTotal - 3 && <p>...</p>}
				{currentPage < newsPagesTotal && <Link href={newsPagesTotal.toString()}>{newsPagesTotal}</Link>}
			</div>
		</div>
	);
}
