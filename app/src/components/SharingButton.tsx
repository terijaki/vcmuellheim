import { Button } from "@mantine/core";
import { Share } from "lucide-react";
import { useEffect, useState } from "react";

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
		navigator
			.share({
				title: pageTitle,
				url: pageURL,
			})
			.catch(() => {
				// Sharing cancellation or interruption is a non-fatal UX event.
			});
	};

	if (!isNativeShare) return null;

	return (
		<Button leftSection={<Share size={16} />} onClick={handleShare}>
			{props.label}
		</Button>
	);
}
