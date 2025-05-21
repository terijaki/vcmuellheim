import SectionHeading from "@/components/layout/SectionHeading";
import { getNews } from "@/data/news";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import NewsCard from "../ui/NewsCard";

export default async function HomeNews() {
	"use cache";
	cacheLife("minutes");

	const data = await getNews(4, undefined);
	// filter out the thumbnail urls
	const thumbnails = data?.docs[0].images
		?.map((i) => (typeof i === "string" ? i : i.url))
		.filter((i) => typeof i === "string");

	return (
		<section className="col-center-content">
			<div id="news" className="scroll-anchor" />
			<SectionHeading text="News" />
			<Suspense
				fallback={
					<div className="col-center-content grid grid-cols-1 md:grid-cols-2 gap-5 flex-wrap">Lade Newsbeiträge</div>
				}
			>
				<div className="col-center-content grid grid-cols-1 md:grid-cols-2 gap-5 flex-wrap">
					{data?.docs.map((post) => (
						<NewsCard
							key={post.id}
							id={post.id}
							title={post.title}
							thumbnails={thumbnails}
							excerpt={post.excerpt || ""}
						/>
					))}
				</div>
				<div className="my-6 flex justify-center">
					<Link href="news" className="button">
						alle Newsbeiträge
					</Link>
				</div>
			</Suspense>
		</section>
	);
}
