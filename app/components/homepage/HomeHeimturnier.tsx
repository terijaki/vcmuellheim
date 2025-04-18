import SectionHeading from "@/app/components/layout/SectionHeading";
import ExportedImage from "next-image-export-optimizer";
import Link from "next/link";

export default function HeimTurnier() {
	const today = new Date();
	if (today < new Date("2025-05-25")) {
		return (
			<section className="col-full-content text-white bg-onyx bg-opacity-95 py-3 px-5 border-lion border-y-4">
				<a
					id="heimturnier"
					className="scroll-anchor"
				></a>
				<ExportedImage
					src="/images/blog/2023/06/21/jugendturnier00034.jpg"
					loading="lazy"
					fill
					alt=""
					className="absolute w-full h-full z-[-10] object-cover"
				/>
				<SectionHeading
					text="Markgräfler Taxi Cup"
					classes="text-white border-white"
				/>
				<p className="text-center text-balance">
					Der Volleyballclub Müllheim veranstaltet dieses Jahr am Samstag den <span className="font-bold whitespace-nowrap">24 Mai 2025</span> erneut ein internationales Jugendturnier und du bist herzlich eingeladen!
				</p>
				<p className="text-center">
					<Link
						href="https://www.tournify.de/live/vcm0525"
						target="_blank"
						className="button border-white m-4"
					>
						weitere Infos
					</Link>
				</p>
			</section>
		);
	}
}
