import { Flex, Image } from "@mantine/core";
import { FaVolleyball as Ball } from "react-icons/fa6";
import { slugify } from "../../../../utils/slugify";
import { useSamsClubByNameSlug, useSamsClubByUuid } from "../lib/hooks";

export default function ClubLogo({ clubUuid, teamName, light }: { clubUuid?: string; teamName?: string; light?: boolean }) {
	const teamSlug = slugify(teamName?.replace(/\s+\d+$/, "") || "");
	const { data: clubByName } = useSamsClubByNameSlug(teamSlug);
	const { data: clubById } = useSamsClubByUuid(clubUuid);
	const clubLogoUrl = clubByName?.logoImageLink || clubById?.logoImageLink;
	const logoName = clubByName?.name || clubById?.name || teamName || "Vereinlogo";

	if (clubLogoUrl) {
		console.log("ClubLogo:", { clubUuid, teamName, clubLogoUrl, logoName });
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
	// }

	return <ClubLogoFallback />;
}

export function ClubLogoFallback() {
	return (
		<Flex pos="relative" justify="center" align="center" w={24} h={24} c="lion">
			<Ball />
		</Flex>
	);
}
