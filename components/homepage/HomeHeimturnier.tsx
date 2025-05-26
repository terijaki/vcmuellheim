import SectionHeading from "@/components/layout/SectionHeading";
import { Box, Button, Center, Text } from "@mantine/core";
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
				<Text>
					Der Volleyballclub Müllheim veranstaltet dieses Jahr am Sonntag den{" "}
					<Text span fw="bold">
						16 Juni 2024
					</Text>{" "}
					erneut ein internationales Jugendturnier und du bist herzlich eingeladen!
				</Text>
				<Center>
					<Button component={Link} href="/tournament/jugend2024">
						weitere Infos
					</Button>
				</Center>
			</Box>
		);
	}
}
