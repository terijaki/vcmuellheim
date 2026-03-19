import type { AnchorProps } from "@mantine/core";
import { Anchor, Group, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { FaLocationDot as IconLocation } from "react-icons/fa6";

interface MapsLinkProps extends Omit<AnchorProps, "href" | "component" | "target"> {
	street?: string | null;
	postal?: string | null;
	city?: string | null;
	name?: string | null;
}

export default function MapsLink({ street, postal, city, name, ...anchorProps }: MapsLinkProps) {
	const [mapsUrl, setMapsUrl] = useState<string | null>(null);

	useEffect(() => {
		let addressString = "";
		if (name) addressString += `${name}, `;
		if (street) addressString += street;
		if (street && (postal || city)) addressString += ", ";
		if (postal) addressString += `${postal}`;
		if (postal && city) addressString += " ";
		if (city) addressString += `${city}`;

		let isAppleDevice = false;
		function hasUserAgentData(n: Navigator): n is Navigator & { userAgentData: { platform: string } } {
			return "userAgentData" in n && typeof (n as { userAgentData?: { platform?: string } }).userAgentData?.platform === "string";
		}
		if (hasUserAgentData(navigator)) {
			isAppleDevice = /iPhone|iPad|iPod|Mac/.test(navigator.userAgentData.platform);
		} else if (navigator.userAgent) {
			isAppleDevice = /iPhone|iPad|iPod|Mac/.test(navigator.userAgent);
		}

		if (isAppleDevice) {
			setMapsUrl(`https://maps.apple.com/?q=${encodeURIComponent(addressString)}`);
		} else {
			setMapsUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressString)}`);
		}
	}, [street, postal, city, name]);

	const displayName = name || city;

	// Before the effect runs, just show the name without a link
	if (!mapsUrl) return <>{displayName}</>;

	return (
		<Anchor component="a" href={mapsUrl} underline="never" target="_blank" rel="noopener noreferrer" {...anchorProps}>
			<Group gap={4} wrap="nowrap" align="baseline">
				<IconLocation />
				<Text lineClamp={2}>{displayName}</Text>
			</Group>
		</Anchor>
	);
}
