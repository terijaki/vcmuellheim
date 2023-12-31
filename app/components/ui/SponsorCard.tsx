import React from "react";
import Link from "next/link";
import ExportedImage from "next-image-export-optimizer";

export default function SponsorCard(props: { name?: string; website?: string; logo?: string; date?: Date }) {
	if (!props.website || !props.logo) {
		return null;
	}
	return (
		<Link
			href={props.website}
			target="_blank"
			rel="noopener noreferrer"
			className="relative block min-h-20 min-w-20 w-full h-full hover:cursor-pointer"
		>
			<ExportedImage
				unoptimized={true}
				fill
				loading="lazy"
				src={props.logo}
				className="object-contain max-w-full max-h-full "
				alt={"" + props.name}
			/>
		</Link>
	);
	// }
}
