import SectionHeading from "@/components/layout/SectionHeading";
import { Box } from "@mantine/core";
import Image from "next/image";
import Link from "next/link";
import ScrollAnchor from "./ScrollAnchor";

export default function HeimTurnier() {
	const today = new Date();
	if (today < new Date("2024-06-17")) {
		return (
			<Box bg="onyx" className="col-full-content text-white bg-onyx bg-opacity-95 py-3 px-5 border-lion border-y-4">
				<ScrollAnchor name="heimturnier" />
				<Image
					src="images/blog/2023/06/21/jugendturnier00022.jpg"
					loading="lazy"
					fill
					alt=""
					className="absolute w-full h-full z-[-10] object-cover"
				/>
				<SectionHeading text="Markgräfler Taxi Cup" color="white" />
				<p className="text-center text-balance">
					Der Volleyballclub Müllheim veranstaltet dieses Jahr am Sonntag den{" "}
					<span className="font-bold whitespace-nowrap">16 Juni 2024</span> erneut ein internationales Jugendturnier und
					du bist herzlich eingeladen!
				</p>
				<p className="text-center">
					<Link href="/tournament/jugend2024" className="button border-white m-4">
						weitere Infos
					</Link>
				</p>
			</Box>
		);
	}
}
