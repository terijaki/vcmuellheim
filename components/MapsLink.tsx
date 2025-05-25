"use client";

import { Anchor, Group } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaLocationDot as IconLocation } from "react-icons/fa6";

type MapsLinkLocation = {
	name?: string | null;
	address?: {
		street?: string | null;
		postalCode?: number | null;
		city?: string | null;
	};
};

export default function MapsLink({ location }: { location: MapsLinkLocation }) {
	const [mapsUrl, setMapsUrl] = useState<string | null>(null);

	if (!location) return null;
	const displayName = location.name || location.address?.city;
	if (!displayName) return null;

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
			const isAppleDevice =
				navigator.platform.includes("iPhone") ||
				navigator.platform.includes("iPad") ||
				navigator.platform.includes("iPod") ||
				navigator.platform === "MacIntel";

			if (isAppleDevice) {
				setMapsUrl(`https://maps.apple.com/?q=${encodeURIComponent(addressString)}`);
			} else {
				setMapsUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressString)}`);
			}
		}
	}, [location]);

	if (!mapsUrl) return null;
	// Before the effect runs, just show the name without a link
	if (!mapsUrl) return <>{displayName}</>;

	return (
		<Anchor component={Link} href={mapsUrl} c="turquoise" target="_blank">
			<Group gap="xs">
				<IconLocation />
				{displayName}
			</Group>
		</Anchor>
	);
}
