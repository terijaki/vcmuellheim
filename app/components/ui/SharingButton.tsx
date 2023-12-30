"use client";
import { FaShare as IconShare } from "react-icons/fa6";
import React, { useEffect, useState } from "react";

export default function SharingButon(props: { title: string; url: string; label: string }) {
	return null; // TODO: disabled for now until I figure it out 😊
	const [pageURL, setPageURL] = useState("");
	const [isNativeShare, setNativeShare] = useState(false);
	useEffect(() => {
		setPageURL(window.location.href);
		if (process.env.NODE_ENV !== "development" && navigator.canShare({ title: props.title, url: props.url })) {
			setNativeShare(true);
		}
	}, [props.title, props.url]);

	// navigator.share is only available on HTTPS connections and will therefore not work on localhost during dev mode
	if (process.env.NODE_ENV === "development" || isNativeShare) {
		return (
			<span
				key={"sharing-button"}
				className="button-slim hover:cursor-pointer rounded-md text-sm"
				onClick={() => ShareAction({ title: props.title, url: props.url })}
			>
				<IconShare className="inline mr-1" />
				{props.label}
			</span>
		);
	}
}

function ShareAction(props: { title: string; url: string }) {
	const [pageURL, setPageURL] = useState("");
	const [isNativeShare, setNativeShare] = useState(false);
	useEffect(() => {
		setPageURL(window.location.href);
		if (navigator.canShare({ title: props.title, url: props.url })) {
			setNativeShare(true);
		}
	}, [props.title, props.url]);

	if (isNativeShare) {
		navigator.share({
			title: props.title,
			url: props.url,
		});
	}
}
