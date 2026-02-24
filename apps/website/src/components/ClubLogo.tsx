import { Flex, Image } from "@mantine/core";
import { useState } from "react";
import { FaVolleyball as Ball } from "react-icons/fa6";
import { buildServiceUrl } from "@/apps/shared/lib/api-url";

type ClubLogoProps = ({ clubUuid: string; clubSlug?: never } | { clubSlug: string; clubUuid?: never }) & {
	label?: string;
	light?: boolean;
};

export default function ClubLogo({ clubUuid, clubSlug, label, light }: ClubLogoProps) {
	const [failed, setFailed] = useState(false);
	const identifier = clubUuid || clubSlug;
	const paramName = clubUuid ? "clubUuid" : "clubSlug";

	if (!identifier || failed) {
		return <ClubLogoFallback />;
	}

	// Point directly at the CDN URL so the browser handles HTTP caching
	// (Cache-Control: public, max-age=90d, immutable is set by the logo proxy).
	// Using <img> instead of fetch()+base64 also avoids the call stack overflow
	// that occurs with String.fromCharCode.apply() on large images (Safari bug).
	// A non-image response (204 no logo / 404) triggers onError → fallback.
	const src = `${buildServiceUrl("sams")}/logos?${paramName}=${identifier}`;

	return (
		<Flex justify="center" align="center" w={24} h={24} style={{ flexShrink: 0 }}>
			<Image
				src={src}
				alt={`Logo: ${label || "Vereinlogo"}`}
				onError={() => setFailed(true)}
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
