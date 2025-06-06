import { getSamsClubByName, getSamsClubBySamsUuid } from "@/data/samsClubs";
import { Flex } from "@mantine/core";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Image from "next/image";
import { FaVolleyball as Ball } from "react-icons/fa6";

export default async function ClubLogo({
	clubUuid,
	teamName,
	light,
}: { clubUuid?: string | null; teamName?: string | null; light?: boolean }) {
	"use cache";
	cacheLife("max");

	if (clubUuid || teamName) {
		let clubLogoUrl: string | undefined = undefined;
		let logoName = "";

		if (clubUuid) {
			const clubData = await getSamsClubBySamsUuid(clubUuid);
			if (clubData?.logo) clubLogoUrl = clubData.logo;
			if (clubData?.name) logoName = clubData.name;
		} else if (teamName) {
			const clubData = await getSamsClubByName(teamName.slice(0, -3));
			if (clubData?.logo) clubLogoUrl = clubData.logo;
			if (clubData?.name) logoName = clubData.name;
		}

		if (clubLogoUrl)
			return (
				<Flex pos="relative" justify="center" align="center" w={24} h={24} style={{ flexShrink: 0 }}>
					<Image
						src={clubLogoUrl}
						fill
						loading="lazy"
						placeholder="empty"
						alt={`Logo: ${logoName}`}
						style={{
							objectFit: "contain",
							borderRadius: "50%",
							filter: light ? "saturate(0) brightness(0) invert(1)" : undefined,
							mixBlendMode: light ? undefined : "multiply",
						}}
					/>
				</Flex>
			);
	}

	return <ClubLogoFallback />;
}

export function ClubLogoFallback() {
	return (
		<Flex pos="relative" justify="center" align="center" w={24} h={24} c="lion">
			<Ball />
		</Flex>
	);
}
