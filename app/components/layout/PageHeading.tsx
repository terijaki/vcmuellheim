import Image from "next/image";

export default function PageHeading(props: {
	title: string;
	subtitle?: string;
	subtitleDate?: boolean;
}) {
	// grid info: seaction is placed the in "full-content" grid area to take up the maximum post width
	// background & gradient info: the image is the bg of the section, the section:before adds the first layer and section:after the final gradient layer
	return (
		<section
			className="col-full-content
					overflow-hidden z-10
					bg-cover bg-no-repeat bg-center
					bg-gradient-overlay bg-gradient-overlay-double"
		>
			<Image
				width={948}
				height={639}
				alt=""
				src={"/images/backgrounds/pageheading.jpg"}
				className="absolute w-full h-full z-[-10] object-cover"
			/>
			{/* grid info: section now applies the main grid for its own children */}
			<div className="grid grid-cols-main-grid py-6 *:text-balance *:text-center">
				{/* grid info: children orient itself on the main grid (enforced by the parent) */}
				{/* grid info: this can be simplified in the future once "subgrid" is properly supported */}
				<h1 className="text-white text-2xl md:text-3xl font-montserrat font-semibold col-center-content">
					{props.title}
				</h1>
				{props.subtitle && props.subtitleDate && (
					<time
						className="col-center-content text-white text-sm font-thin mt-1"
						dateTime={props.subtitle}
					>
						{new Date(props.subtitle).toLocaleString("de-DE", {
							day: "numeric",
							month: "short",
							year: "numeric",
						})}
					</time>
				)}
				{props.subtitle && !props.subtitleDate && (
					<p className="col-center-content text-white text-sm font-thin mt-1">
						{props.subtitle}
					</p>
				)}
			</div>
		</section>
	);
}
