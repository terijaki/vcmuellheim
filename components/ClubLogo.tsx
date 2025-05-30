import { samsClubDataByClubName } from "@/utils/sams/sams-server-actions";
import { Flex } from "@mantine/core";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Image from "next/image";
import { FaVolleyball as Ball } from "react-icons/fa6";

export default async function ClubLogo({ clubName }: { clubName?: string | null }) {
	"use cache";
	cacheLife("days");

	if (!process.env.DOCKER_BUILD && clubName) {
		const clubData = await samsClubDataByClubName(clubName);
		if (clubData?.logo)
			return (
				<Flex pos="relative" justify="center" align="center" w={24} h={24}>
					<Image
						src={clubData.logo}
						fill
						loading="lazy"
						placeholder="empty"
						alt={`Logo: ${clubName}`}
						style={{ mixBlendMode: "multiply", objectFit: "contain", borderRadius: 8 }}
					/>
				</Flex>
			);
	}

	return <ClubLogoFallback />;
}

export function ClubLogoFallback({ className }: { className?: string | null }) {
	return (
		<Flex pos="relative" justify="center" align="center" w={24} h={24} c="lion">
			<Ball />
		</Flex>
	);
}
