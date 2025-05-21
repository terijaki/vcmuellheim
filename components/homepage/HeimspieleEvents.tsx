import type getEvents from "@/utils/getEvents";
import Link from "next/link";
import { FaCircleInfo as IconInfo, FaLocationDot as IconLocation } from "react-icons/fa6";

type EventProps = Awaited<ReturnType<typeof getEvents>>[number];

export default function HeimspieleEvents(props: EventProps & { totalSiblings?: number }) {
	return (
		<div className="card bg-onyx text-white inline-block w-full break-inside-avoid mb-3" key={props.title}>
			<div>
				<time className="text-lion mr-1">
					{props.end
						? props.start.toLocaleString("de-DE", { day: "2-digit", month: "2-digit" })
						: props.start.toLocaleString("de-DE", { dateStyle: "medium" })}
					{props.end && <span>-{props.end.toLocaleString("de-DE", { dateStyle: "short" })}</span>}
				</time>
				{props.location && (props.location.name || props.location.city) && (
					<Link
						href={`https://www.google.com/maps/search/?api=1&query=${props.location?.street ? `${props.location?.street},` : ""}${props.location?.postalCode ? `${props.location?.postalCode},` : ""}${props.location?.city ? `${props.location?.city},` : ""}${props.location?.name ? props.location?.name : ""}`}
						target="_blank"
						rel="noopener noreferrer"
						className="text-turquoise"
					>
						<IconLocation className="inline align-baseline" />
						{props.location?.name ? props.location?.name : props.location?.city}
						{props.location?.street && <span className="hidden xl:inline">, {props.location?.street}</span>}
					</Link>
				)}
			</div>
			<div className="font-bold flex gap-1">
				{props.title}
				{props.start &&
					props.start.getUTCHours() + props.start.getUTCMinutes() > 0 &&
					` ab ${props.start.toLocaleString("de-DE", { timeStyle: "short" })} Uhr`}
			</div>
			<div className="pl-4 opacity-75">{props.description}</div>
			{props.url && (
				<Link href={props.url} className="flex gap-1 justify-end place-items-center text-turquoise hover:text-white">
					<IconInfo /> mehr
				</Link>
			)}
		</div>
	);
}
