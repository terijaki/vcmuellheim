import { Flex, Image } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { FaVolleyball as Ball } from "react-icons/fa6";
import { buildServiceUrl } from "@/apps/shared/lib/api-url";

type ClubLogoProps = ({ clubUuid: string; clubSlug?: never } | { clubSlug: string; clubUuid?: never }) & {
	label?: string;
	light?: boolean;
};

export default function ClubLogo({ clubUuid, clubSlug, label, light }: ClubLogoProps) {
	const identifier = clubUuid || clubSlug;
	const paramName = clubUuid ? "clubUuid" : "clubSlug";

	const {
		data: logoData,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["clubLogo", identifier],
		queryFn: async () => {
			const response = await fetch(`${buildServiceUrl("sams")}/logos?${paramName}=${identifier}`, {
				method: "GET",
			});
			if (response.status === 200) {
				// Get the Content-Type header to construct the proper data URL
				const contentType = response.headers.get("content-type") || "image/png";
				const bytes = await response.bytes();
				// Convert binary data to base64 and create a data URL
				const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
				return `data:${contentType};base64,${base64}`;
			}
			if (response.status === 204) {
				console.info("No logo available for this club", { identifier });
				return null;
			}
			if (response.status === 404) {
				console.warn("Club not found for logo request", { identifier });
				return null;
			}
			if (!response.ok) {
				throw new Error(`Error fetching club logo: ${response.statusText}`);
			}
		},
		enabled: !!identifier,
	});

	if (!identifier || isLoading || isError || !logoData) {
		return <ClubLogoFallback />;
	}

	return (
		<Flex justify="center" align="center" w={24} h={24} style={{ flexShrink: 0 }}>
			<Image
				src={logoData}
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
