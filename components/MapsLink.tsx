"use client";

import type { AnchorProps } from "@mantine/core";
import { Anchor, Group, Text } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaLocationDot as IconLocation } from "react-icons/fa6";

type MapsLinkLocation = {
	name?: string | null;
	address?: {
		street?: string | null;
		postalCode?: string | number | null;
		city?: string | null;
	};
};

interface MapsLinkProps extends Omit<AnchorProps, "href" | "component" | "target"> {
	location: MapsLinkLocation;
}

export default function MapsLink({ location, ...anchorProps }: MapsLinkProps) {
	const [mapsUrl, setMapsUrl] = useState<string | null>(null);

	useEffect(() => {
		if (typeof location === "string") {
			setMapsUrl(location);
		} else if (location.address) {
			let addressString = "";
			if (typeof location.address !== "object") return;
			const { street, postalCode, city } = location.address;
			if (location.name) addressString += `${location.name}, `;
			if (street) addressString += street;
			if (street && (postalCode || city)) addressString += ", ";
			if (postalCode) addressString += `${postalCode}`;
			if (postalCode && city) addressString += " ";
			if (city) addressString += `${city}`;

			// Check for iOS/macOS
			const isAppleDevice = navigator.platform.includes("iPhone") || navigator.platform.includes("iPad") || navigator.platform.includes("iPod") || navigator.platform === "MacIntel";

			if (isAppleDevice) {
				setMapsUrl(`https://maps.apple.com/?q=${encodeURIComponent(addressString)}`);
			} else {
				setMapsUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressString)}`);
			}
		}
	}, [location]);

	if (!location) return null;
	const displayName = location.name || location.address?.city;
	if (!displayName) return null;

	if (!mapsUrl) return null;
	// Before the effect runs, just show the name without a link
	if (!mapsUrl) return <>{displayName}</>;

	return (
		<Anchor component={Link} href={mapsUrl} underline="never" target="_blank" {...anchorProps}>
			<Group gap={4} wrap="nowrap" align="baseline">
				<IconLocation />
				<Text lineClamp={2}>{displayName}</Text>
			</Group>
		</Anchor>
	);
}
