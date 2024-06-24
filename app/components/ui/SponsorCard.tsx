import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function SponsorCard(props: { name?: string; website?: string; logo?: string; date?: Date }) {
	if (!props.website) {
		return null;
	}
	if (props.logo) {
		return (
			<Link
				href={props.website}
				target="_blank"
				rel="noopener noreferrer"
				className="relative block min-h-20 min-w-20 w-full h-full hover:cursor-pointer"
			>
				<Image
					unoptimized
					fill
					loading="lazy"
					src={props.logo}
					className="object-contain max-w-full max-h-full "
					alt={"" + props.name}
				/>
			</Link>
		);
	} else {
		{
			return (
				<Link
					key={props.name}
					href={props.website}
					target="_blank"
					rel="noopener noreferrer"
					className="flex justify-center items-center text-center font-bold text-2xl md:text-4xl lg:text-5xl text-pretty font-industrial select-none "
				>
					{props.name}
				</Link>
			);
		}
	}
}
