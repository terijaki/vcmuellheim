"use client";
import { FaShare as IconShare } from "react-icons/fa6";
import React, { useEffect, useState } from "react";

export default function SharingButon(props: { label: string; wrapper?: boolean }) {
	const [pageURL, setPageURL] = useState("");
	const [pageTitle, setPageTitle] = useState("");
	const [isNativeShare, setNativeShare] = useState(false);
	useEffect(() => {
		setPageURL(window.location.href);
		setPageTitle(document.title);
		if (navigator.share && navigator.canShare({ title: pageTitle, url: pageURL })) {
			setNativeShare(true);
		}
	}, [pageTitle, pageURL]);

	if (isNativeShare) {
		if (props.wrapper) {
			return (
				<div className="text-center mb-8">
					<span
						key={"sharing-button"}
						className="button-slim hover:cursor-pointer rounded-md text-sm"
						onClick={() => ShareAction({ title: pageTitle, url: pageURL })}
					>
						<IconShare className="inline mr-1" />
						{props.label}
					</span>
				</div>
			);
		} else {
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
