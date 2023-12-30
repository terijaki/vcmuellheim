import Link from "next/link";
import React from "react";
import ExportedImage from "next-image-export-optimizer";

export default function MembersCard(props: { name?: string; email?: string; avatar?: string; function?: string }) {
	if (!props.name || !props.avatar) {
		return null;
	}
	let email = "";
	let emailClass = "";
	if (props.email) {
		email = "mailto:" + props.email;
	} else {
		emailClass = " hover:cursor-default";
	}
	return (
		<Link
			className={
				"grid grid-cols-[4rem,1fr] sm:grid-cols-[5rem,1fr] justify-items-start place-items-center bg-white rounded-2xl shadow overflow-hidden group text-base sd:text-xs select-none" + emailClass
			}
			href={email}
			scroll={false}
		>
			<div className="overflow-hidden w-full h-full aspect-square group">
				<ExportedImage
					width={96}
					height={96}
					// blurDataURL=""
					src={props.avatar}
					alt={props.name}
					className="object-cover h-full w-full group-hover:scale-105 duration-300"
				/>
			</div>
			<div className="grid grid-cols-1 overflow-hidden w-full px-2">
				<div className="text-sm sm:text-base">{props.name}</div>
				{props.function && <div className="hidden md:block whitespace-nowrap hyphens-auto text-xs pr-2">{props.function}</div>}
			</div>
			{props.function && <div className="md:hidden bg-blumine text-white w-full h-full hyphens-auto text-xs text-center col-span-2">{props.function}</div>}
		</Link>
	);
}
