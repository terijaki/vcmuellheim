import Link from "next/link";
import { eventObject } from "@/app/utils/getEvents";
import { FaLocationDot as IconLocation } from "react-icons/fa6";

export default function Events(props: eventObject & { totalSiblings?: number }) {
	if (!props.totalSiblings) {
		// if not specified how many siblings there will be, assume 0
		// this controls the zebra display for odd/even scenarios
		props.totalSiblings = 0;
	}

	if (props.title && props.start) {
		return (
			<div
				key={props.title + props.start}
				className={"block gap-x-4 px-4 text-onyx " + (props.totalSiblings % 2 ? " odd:bg-black/5" : " even:bg-black/5") + " "}
			>
				<time
					className="block text-sm pt-1"
					data-label="datetime"
				>
					{props.end ? props.start.toLocaleString("de-DE", { day: "2-digit", month: "2-digit" }) : props.start.toLocaleString("de-DE", { dateStyle: "medium" })}
					{props.start && props.start.getUTCHours() + props.start.getUTCMinutes() > 0 && " " + props.start.toLocaleString("de-DE", { timeStyle: "short" }) + " Uhr"}
					{props.end && <span> - {props.end.toLocaleString("de-DE", { dateStyle: "medium" })}</span>}
				</time>
				<div
					className="py-1 font-bold"
					data-label="title"
				>
					{props.url ? (
						<Link
							key={props.title + props.start}
							href={props.url}
							className={"gap-x-4 text-onyx hover:text-blumine"}
						>
							{props.title}
						</Link>
					) : (
						<>{props.title}</>
					)}
				</div>
				{props.description && (
					<div
						className="text-lion font-thin text-sm whitespace-break-spaces line-clamp-4 mb-1 break-word"
						data-label="description"
					>
						{props.description}
					</div>
				)}
				{/* TODO: Location without all details */}
				<div
					className="pb-1 sm:py-1 mr-3 sm:mr-0"
					data-label="location"
				>
					{props.location && props.location.city && props.location.postalCode && props.location.street && props.location.name ? (
						<Link
							href={"https://www.google.com/maps/search/?api=1&query=" + props.location.street + "," + props.location.postalCode + "," + props.location.city + "," + props.location.name}
							className="hyperlink line-clamp-1 break-all text-sm md:text-base inline-flex items-center sd:items-baseline"
							target="_blank"
							rel="noopener noreferrer"
						>
							<IconLocation className="inline" />
							{props.location.city} <span className="text-sm md:text-base ml-1"> ({props.location.street.replace("straße", "str.").replace("strasse", "str.")})</span>
						</Link>
					) : (
						""
					)}
				</div>
			</div>
		);
	}
}
