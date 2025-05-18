import Members from "@/app/components/homepage/MemberList";
import SectionHeading from "@/app/components/layout/SectionHeading";
import { unstable_cacheLife as cacheLife } from "next/cache";

export default async function HomeMembers() {
	"use cache";
	cacheLife("hours");

	return (
		<section className="col-full-content sm:col-center-content pb-12">
			<div id="verein" className="scroll-anchor" />
			<SectionHeading text="Vorstand" />
			<Members memberType="board" />
			<SectionHeading text="Trainer & Betreuer" classes="mt-8" />
			<Members memberType="trainers" random={true} />
		</section>
	);
}
