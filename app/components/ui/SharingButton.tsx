"use client";
import { FaShare as IconShare } from "react-icons/fa6";
import React, { useEffect, useState } from "react";

export default function SharingButon(props: { label: string }) {
	const [pageURL, setPageURL] = useState("");
	const [pageTitle, setPageTitle] = useState("");
	const [isNativeShare, setNativeShare] = useState(false);
	useEffect(() => {
		setPageURL(window.location.href);
		setPageTitle(document.title);
		if (navigator.canShare({ title: pageTitle, url: pageURL })) {
			setNativeShare(true);
		}
	}, [pageTitle, pageURL]);

	if (isNativeShare) {
		return (
			<span
				key={"sharing-button"}
				className="button-slim hover:cursor-pointer rounded-md text-sm"
				onClick={() => ShareAction({ title: pageTitle, url: pageURL })}
			>
				<IconShare className="inline mr-1" />
				{props.label}
			</span>
		);
	}
}

function ShareAction(props: { title: string; url: string }) {
	navigator
		.share({
			title: props.title,
			url: props.url,
		})
		.then(() => console.log("Sharing Dialog opened with: " + props.title + " & " + props.url))
		.catch((error) => console.log("Sharing wasn't completed"));
}
