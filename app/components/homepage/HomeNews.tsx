import SectionHeading from "@/app/components/layout/SectionHeading";
import NewsList from "@/app/components/homepage/NewsList";
import Link from "next/link";

export default function HomeNews() {
	return (
		<section className="col-center-content">
			<SectionHeading text="News" />
			<div className="col-center-content grid grid-cols-1 md:grid-cols-2 gap-5 flex-wrap">
				<NewsList
					pageStart={0}
					pageEnd={4}
				/>
			</div>
			<div className="my-6 flex justify-center">
				<Link
					href="news"
					className="button"
				>
					alle Newsbeiträge
				</Link>
			</div>
		</section>
	);
}
