import NewsList from "@/app/components/homepage/NewsList";
import SectionHeading from "@/app/components/layout/SectionHeading";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";

export default async function HomeNews() {
	"use cache";
	cacheLife("minutes");
	
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
					<NewsList pageStart={0} pageEnd={4} />
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
