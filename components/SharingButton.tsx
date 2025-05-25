"use client";
import { Button } from "@mantine/core";
import { useEffect, useState } from "react";
import { FaShare as IconShare } from "react-icons/fa6";

export default function SharingButton(props: { label: string }) {
	const [pageURL, setPageURL] = useState("");
	const [pageTitle, setPageTitle] = useState("");
	const [isNativeShare, setNativeShare] = useState(false);

	useEffect(() => {
		// Set URL and title only when component mounts
		const currentURL = window.location.href;
		const currentTitle = document.title;

		setPageURL(currentURL);
		setPageTitle(currentTitle);

		// Check if native sharing is supported
		setNativeShare(!!navigator.canShare && navigator.canShare({ title: currentTitle, url: currentURL }));
	}, []);

	const handleShare = () => {
		if (isNativeShare) {
			navigator
				.share({
					title: pageTitle,
					url: pageURL,
				})
				.then(() => console.log(`Sharing Dialog opened with: ${pageTitle} & ${pageURL}`))
				.catch((error) => console.log("Sharing wasn't completed"));
		} else {
			// Fallback for browsers that don't support Web Share API
			console.log("Native sharing not supported on this browser");
			// Could implement clipboard copy or other fallback here
		}
	};

	if (!isNativeShare) return null;

	return (
		<Button leftSection={<IconShare className="inline mr-1" />} onClick={handleShare}>
			{props.label}
		</Button>
	);
}
