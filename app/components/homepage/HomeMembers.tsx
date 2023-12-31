import SectionHeading from "@/app/components/layout/SectionHeading";
import Members from "@/app/components/homepage/MemberList";

export default function HomeKontakt() {
	return (
		<section
			id="verein"
			className="col-center-content pb-12"
		>
			<SectionHeading text="Vorstand" />
			<Members memberType="board" />
			<SectionHeading
				text="Trainer & Betreuer"
				classes="mt-8"
			/>
			<Members
				memberType="trainers"
				random={true}
			/>
		</section>
	);
}
