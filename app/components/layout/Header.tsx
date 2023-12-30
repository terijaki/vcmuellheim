"use client";
import Link from "next/link";
import React, { useState } from "react";
import { FaVolleyball as Logo, FaBars as Bars, FaXmark as Xmark } from "react-icons/fa6";
import { navbarLinks } from "@/app/utils/navbarLinks";
import Socials from "@/app/components/layout/Socials";

function navbarLinksRender() {
	const navLinks = navbarLinks.map((item) => {
		return (
			<li key={item.name}>
				<Link
					{...item}
					className="hover:text-lion font-medium tracking-normal p-1 md:p-0 block text-lg md:text-base"
				>
					{item.name}
				</Link>
			</li>
		);
	});
	return navLinks;
}

export default function Header() {
	const [isMobileNavOpen, setIsMobileNavOpen] = useState(true);
	return (
		<>
			<header
				id="navigation"
				className="sticky top-0 z-50 grid grid-cols-main-grid py-2 bg-onyx text-white overflow-hidden antialiased select-none"
			>
				<div className="grid grid-cols-[max-content_1fr] align-items-center col-center-content">
					<p
						className="mr-4 flex items-center text-3xl uppercase font-industrial font-medium tracking-widest md:tracking-wide lg:tracking-widest"
						onClick={() => setIsMobileNavOpen(true)}
					>
						<Link
							href="/"
							className="flex"
						>
							<Logo className="mr-2" /> VC Müllheim
						</Link>
					</p>
					<div className="place-self-center justify-self-end md:hidden">
						<div className="grid [grid-template-areas:'stack'] items-center text-2xl duration-100 hover:text-turquoise">
							<Bars
								className={"[grid-area:stack] cursor-pointer duration-500 " + (isMobileNavOpen ? "" : "opacity-0 rotate-[360deg] -z-1 blur-sm")}
								onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
							/>
							<Xmark
								className={"[grid-area:stack] cursor-pointer duration-500 " + (isMobileNavOpen ? "opacity-0 rotate-[-360deg] -z-1 blur-sm" : "")}
								onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
							/>
						</div>
					</div>
					<div
						className={
							(isMobileNavOpen ? "max-h-0 overflow-hidden " : "max-h-screen my-2 duration-500 ") +
							" " +
							"md:max-h-full w-full md:w-auto grid grid-flow-col gap-x-4 md:gap-x-0 col-span-2 md:col-span-1 justify-self-center md:justify-self-end justify-around md:m-0 font-systemui"
						}
					>
						<ul
							className={(isMobileNavOpen ? "" : "grid-flow-row ") + " md:max-h-full md:grid md:grid-flow-col gap-x-2 place-self-center"}
							onClick={() => setIsMobileNavOpen(true)}
						>
							{navbarLinksRender()}
						</ul>
						<ul>
							{Socials().map((socialItem) => (
								<li key={socialItem.name}>
									<Link
										{...socialItem}
										className={"hover:text-lion text-lg font-medium tracking-normal flex gap-x-1 items-center p-1 md:hidden " + (isMobileNavOpen ? " hidden " : "")}
									>
										{socialItem.icon}
										{socialItem.name}
									</Link>
								</li>
							))}
						</ul>
					</div>
				</div>
			</header>
		</>
	);
}
