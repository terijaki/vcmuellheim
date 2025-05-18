import SectionHeading from "@/app/components/layout/SectionHeading";
import SponsorCard from "@/app/components/ui/SponsorCard";
import { getActiveSponsors } from "@/app/utils/getSponsors";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Image from "next/image";
import Marquee from "react-fast-marquee";

export default async function HomeSponsors() {
	"use cache";
	cacheLife("hours");

	const sponsors = await getActiveSponsors();

	if (sponsors.length >= 1) {
		return (
			<section className="col-full-content text-white bg-gradient-overlay pb-3">
				<div id="sponsors" className="scroll-anchor" />
				<Image
					src="/images/backgrounds/sponsors.jpg"
					loading="lazy"
					fill
					alt=""
					className="absolute w-full h-full z-[-10] object-cover"
				/>
				<SectionHeading text={sponsors.length === 1 ? "Sponsor" : "Sponsoren"} classes="text-white border-white" />
				<Sponsors sponsors={sponsors} />
			</section>
		);
	}
}

async function Sponsors({ sponsors }: { sponsors: Awaited<ReturnType<typeof getActiveSponsors>> }) {
	if (sponsors.length > 3) {
		return (
			<div className="grid grid-cols-main-grid">
				<p className="row-start-1 col-center-content -mt-2 mb-2 text-center">
					Wir bedanken uns herzlich bei unseren Sponsoren!
				</p>
				<div className="col-full-content mb-6">
					<Marquee pauseOnHover={true} speed={5}>
						{sponsors.map((sponsor) => {
							if (sponsor.name && sponsor.logo) {
								return (
									<div key={sponsor.name} className="h-20 w-36 mx-6">
										<SponsorCard {...sponsor} />
									</div>
								);
							}
							if (sponsor.name) {
								return (
									<div
										key={sponsor.name}
										className="flex justify-center items-center text-center font-bold text-2xl md:text-4xl lg:text-5xl text-balance font-industrial"
									>
										{sponsor.name}
									</div>
								);
							}
						})}
					</Marquee>
				</div>
			</div>
		);
	}
	return (
		<div className="grid grid-cols-main-grid">
			<p className="row-start-1 col-center-content -mt-2 mb-2 text-center">
				Wir bedanken uns herzlich bei {sponsors.length === 1 ? " unserem Sponsor" : "unseren Sponsoren"}!
			</p>
			<div className="row-start-2 col-center-content mb-6 grid grid-flow-col auto-cols-fr gap-8 justify-center">
				{sponsors.map((sponsor) => {
					return (
						<div key={sponsor.name} className="flex justify-center">
							<SponsorCard {...sponsor} />
						</div>
					);
				})}
			</div>
		</div>
	);
}
