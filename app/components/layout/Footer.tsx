import Link from "next/link";
import React from "react";
import Socials from "@/app/components/layout/Socials";

const legals = [
	{ name: "Satzung", url: "/satzung" },
	{ name: "Beitragsordnung", url: "/beitragsordnung" },
	{ name: "Datenschutz", url: "/datenschutz" },
	{ name: "Impressum", url: "/impressum" },
];

export default function Footer() {
	return (
		<footer className="grid grid-cols-main-grid bg-white text-oynx py-2 text-sm text-gray-700 md:text-xs lg:text-sm antialiased select-none">
			<div className="col-center-content grid grid-flow-col md:py-3">
				<ul className="justify-self-start grid grid-flow-row gap-x-2 md:grid-flow-col gap-y-0">
					{legals.map((legal) => (
						<li key={legal.name}>
							<Link
								href={legal.url}
								className="items-center flex hover:text-turquoise"
							>
								{legal.name}
							</Link>
						</li>
					))}
				</ul>
				<ul className="justify-self-end grid grid-flow-row gap-x-2 md:grid-flow-col gap-y-0">
					{Socials().map((social) => (
						<li key={social.name}>
							<a
								{...social}
								className="items-center flex hover:text-turquoise"
							>
								{social.icon}
								<span className="mr-1"></span>
								{social.name}
							</a>
						</li>
					))}
				</ul>
			</div>
		</footer>
	);
}
