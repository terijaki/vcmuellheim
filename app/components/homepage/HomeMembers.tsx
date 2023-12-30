import SectionHeading from "@/app/components/layout/SectionHeading";
import Members from "@/app/components/homepage/MemberList";

export default function HomeKontakt() {
	return (
		<section
			id="verein"
			className="col-center-content mb-6"
		>
			<SectionHeading text="Vorstand" />
			<Members memberType="board" />
			<SectionHeading
				text="Trainer & Betreuer"
				classes="mt-4"
			/>
			<Members
				memberType="trainers"
				random={true}
			/>
		</section>
	);
}
