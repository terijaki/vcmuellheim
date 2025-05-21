import SectionHeading from "@/components/layout/SectionHeading";
import { getSponsors } from "@/data/sponsors";
import type { Sponsor } from "@/data/payload-types";
import Image from "next/image";
import Link from "next/link";
import Marquee from "react-fast-marquee";

export default async function HomeSponsors() {
	const data = await getSponsors();
	if (!data) return null;
	const sponsors = data.docs;

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

async function Sponsors({ sponsors }: { sponsors: Sponsor[] }) {
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

function SponsorCard({ name, logo, website }: Sponsor) {
	const logoUrl = logo && typeof logo === "object" ? logo.url : false;

	if (logoUrl) {
		return (
			<Link
				href={website ?? ""}
				scroll={false}
				target="_blank"
				rel="noopener noreferrer"
				className="relative block min-h-20 min-w-20 w-full h-full hover:cursor-pointer"
				style={{ pointerEvents: website ? undefined : "none" }}
			>
				<Image
					unoptimized
					fill
					loading="lazy"
					src={logoUrl}
					className="object-contain max-w-full max-h-full "
					alt={`${name}`}
				/>
			</Link>
		);
	}
	return (
		<Link
			href={website ?? "#"}
			scroll={false}
			target="_blank"
			rel="noopener noreferrer"
			className="flex justify-center items-center text-center font-bold text-2xl md:text-4xl lg:text-5xl text-pretty font-industrial select-none "
			style={{ pointerEvents: website ? undefined : "none" }}
		>
			{name}
		</Link>
	);
}
