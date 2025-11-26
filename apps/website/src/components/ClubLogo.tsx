import { Flex, Image } from "@mantine/core";
import { FaVolleyball as Ball } from "react-icons/fa6";
import { getSamsClubByName, getSamsClubBySamsUuid } from "@/data/samsClubs";

export default async function ClubLogo({ clubUuid, teamName, light }: { clubUuid?: string | null; teamName?: string | null; light?: boolean }) {
	if (clubUuid || teamName) {
		let clubLogoUrl: string | undefined;
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
				<Flex justify="center" align="center" w={24} h={24} style={{ flexShrink: 0 }}>
					<Image
						src={clubLogoUrl}
						alt={`Logo: ${logoName}`}
						style={{
							width: "100%",
							height: "100%",
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
