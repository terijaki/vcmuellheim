import Image from "next/image";
import { navbarLinks } from "@/app/utils/navbarLinks";
import { FaAnglesDown as IconDown } from "react-icons/fa6";
import Link from "next/link";

import "/images/backgrounds/intro1.jpg";
import "/images/backgrounds/intro2.jpg";
import "/images/backgrounds/intro3.jpg";
import "/images/backgrounds/intro4.jpg";

const backgroundImages = ["/images/backgrounds/intro1.jpg", "/images/backgrounds/intro2.jpg", "/images/backgrounds/intro3.jpg", "/images/backgrounds/intro3.jpg"];

export default function HomeIntro() {
	var backgroundImageRandom = backgroundImages[Math.floor(Math.random() * backgroundImages.length)];

	return (
		<section
			className={
				"col-full-content relative group min-h-[calc(100svh-3rem)] text-white justify-items-center grid grid-cols-main-grid bg-cover bg-no-repeat bg-center before:content-[''] before:absolute before:inset-0 before:block before:z-[-5] before:bg-gradient-to-bl before:to-onyx before:from-blumine before:opacity-80"
			}
		>
			<a
				id="intro"
				className="scroll-anchor"
			></a>
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
						placeholder="empty"
						width={5050}
						height={2880}
						src="/images/logo/logo-weiss.png"
						alt="Vereinslogo"
						className="object-contain border-0"
					/>
				</div>
				<div className="links text-center inline-flex md:hidden gap-x-2 gap-y-2 w-10/12 flex-wrap place-content-center">
					{navbarLinks.map((link) => {
						return (
							<Link
								key={link.name}
								{...link}
								className="button-transparent bg-onyx inline"
							>
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
