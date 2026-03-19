import { Flex, Image } from "@mantine/core";
import { FaVolleyball as Ball } from "react-icons/fa6";
import { useClubLogoUrl } from "../hooks/dataQueries";

type ClubLogoProps = (
	| { clubUuid: string; clubSlug?: never; logoUrl?: never }
	| { clubSlug: string; clubUuid?: never; logoUrl?: never }
	| { logoUrl: string | null | undefined; clubUuid?: never; clubSlug?: never }
) & {
	label?: string;
	light?: boolean;
};

export default function ClubLogo({ clubUuid, clubSlug, logoUrl: proppedLogoUrl, label, light }: ClubLogoProps) {
	const useHook = !!(clubUuid || clubSlug);
	const { data: fetchedLogoUrl } = useClubLogoUrl({ clubUuid, clubSlug });
	const logoUrl = useHook ? fetchedLogoUrl : proppedLogoUrl;

	if (!logoUrl) {
		return <ClubLogoFallback />;
	}

	return (
		<Flex justify="center" align="center" w={24} h={24} style={{ flexShrink: 0 }}>
			<Image
				src={logoUrl}
				alt={`Logo: ${label || "Vereinlogo"}`}
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

export function ClubLogoFallback() {
	return (
		<Flex pos="relative" justify="center" align="center" w={24} h={24} c="lion">
			<Ball />
		</Flex>
	);
}
