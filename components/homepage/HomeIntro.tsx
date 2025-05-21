import { navbarLinks } from "@/utils/navbarLinks";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Image from "next/image";
import Link from "next/link";
import { FaAnglesDown as IconDown } from "react-icons/fa6";

const backgroundImages = [
	"/images/backgrounds/intro1.jpg",
	"/images/backgrounds/intro2.jpg",
	"/images/backgrounds/intro3.jpg",
	"/images/backgrounds/intro3.jpg",
];

export default async function HomeIntro() {
	"use cache";
	cacheLife("hours");

	const backgroundImageRandom = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];

	return (
		<section
			className={
				"col-full-content relative group min-h-[calc(80svh-3rem)] text-white justify-items-center grid grid-cols-main-grid bg-cover bg-no-repeat bg-center before:content-[''] before:absolute before:inset-0 before:block before:z-[-5] before:bg-gradient-to-bl before:to-onyx before:from-blumine before:opacity-80"
			}
		>
			<div id="intro" className="scroll-anchor" />
			<Image
				fill
				priority
				alt=""
				src={backgroundImageRandom}
				className="absolute w-full h-full z-[-10] object-cover"
				quality={75}
			/>
			<div className="col-center-content w-full mt-6 flex flex-col items-center justify-center">
				<p className="font-black text-2xl">Willkommen beim</p>
				<div className="inline-block relative -mt-4 mb-4 mx-6 w-10/12 max-w-xl aspect-video">
					<Image
						priority
						fill
						src="/images/logo/logo-weiss.png"
						alt="Vereinslogo"
						className="object-contain border-0"
					/>
				</div>
				<div className="links text-center inline-flex md:hidden gap-x-2 gap-y-2 w-10/12 flex-wrap place-content-center pb-6">
					{navbarLinks.map((link) => {
						return (
							<Link key={link.name} {...link} className="button-transparent bg-onyx inline">
								{link.name}
							</Link>
						);
					})}
				</div>
			</div>
			<IconDown className="scroll-indicator absolute right-5 bottom-5 text-2xl animate-pulse opacity-0" />
		</section>
	);
}
