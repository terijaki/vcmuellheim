"use client";
import type { Location } from "@/data/payload-types";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function MapsLink({ location }: { location: Location }) {
	const [mapsUrl, setMapsUrl] = useState<string | null>(null);

	useEffect(() => {
		if (location.address) {
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

	if (typeof location !== "object") return null;

	// Before the effect runs, just show the name without a link
	if (!mapsUrl) return <>{location.name}</>;

	return (
		<Link href={mapsUrl} target="_blank">
			{location.name}
		</Link>
	);
}
