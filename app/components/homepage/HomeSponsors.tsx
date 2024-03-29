import Sponsors from "@/app/components/homepage/Sponsor";
import { getActiveSponsors } from "@/app/utils/getSponsors";
import SectionHeading from "@/app/components/layout/SectionHeading";
import ExportedImage from "next-image-export-optimizer";

export default function HomeSponsors() {
	if (getActiveSponsors().length >= 1) {
		return (
			<section className="col-full-content text-white bg-gradient-overlay pb-3">
				<a
					id="sponsors"
					className="scroll-anchor"
				></a>
				<ExportedImage
					src="images/backgrounds/sponsors.jpg"
					loading="lazy"
					fill
					alt=""
					className="absolute w-full h-full z-[-10] object-cover"
				/>
				<SectionHeading
					text={getActiveSponsors().length == 1 ? "Sponsor" : "Sponsoren"}
					classes="text-white border-white"
				/>
				<Sponsors />
			</section>
		);
	}
}
