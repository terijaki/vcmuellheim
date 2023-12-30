import React from "react";
import ExportedImage from "next-image-export-optimizer";

// sponsors are displayed based in their date
// const SPONSOR_DURATION = 12; // in months

export default function SponsorCard(props: { name?: string; website?: string; logo?: string; date?: Date }) {
	// const dateToday = new Date().getTime();
	// const dateSponsorMax = props.date?.setMonth(props.date?.getMonth() + SPONSOR_DURATION);
	if (!props.website || !props.logo || !props.date) {
		return null;
	}
	// if (dateSponsorMax && dateSponsorMax > dateToday) {
	// console.log(new Date(dateSponsorMax) + " 🌈 " + new Date(dateToday) + props.name);
	return (
		<a
			href={props.website}
			target="_blank"
			rel="noopener noreferrer"
		>
			<div className="h-full w-full relative">
				<ExportedImage
					unoptimized={true}
					fill
					loading="lazy"
					src={props.logo}
					className="object-contain"
					alt={"" + props.name}
				/>
			</div>
		</a>
	);
	// }
}
