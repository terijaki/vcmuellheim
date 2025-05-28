import { samsClubDataByClubName } from "@/utils/sams/sams-server-actions";
import { Box } from "@mantine/core";
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
				<Box pos="relative" w={24} h={24}>
					<Image
						src={clubData.logo}
						fill
						loading="lazy"
						placeholder="empty"
						alt={`Logo: ${clubName}`}
						objectFit="contain"
						style={{ mixBlendMode: "multiply" }}
					/>
				</Box>
			);
	}

	return <ClubLogoFallback />;
}

export function ClubLogoFallback({ className }: { className?: string | null }) {
	return (
		<Box pos="relative" w={24} h={24}>
			<Ball className="opacity-50" />
		</Box>
	);
}
