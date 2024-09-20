"use client";
import Socials from "@/app/components/layout/Socials";
import { navbarLinks } from "@/app/utils/navbarLinks";
import Link from "next/link";
import { Fragment, useState } from "react";
import { FaBars as Bars, FaVolleyball as Logo, FaXmark as Xmark } from "react-icons/fa6";

function navbarLinksRender() {
	const navLinks = navbarLinks.map((item, index) => {
		return (
			<Fragment key={item.name}>
				{index != 0 && <li className="hidden md:block opacity-30">&#x2022;</li>}
				<li>
					<Link
						{...item}
						className="hover:text-lion font-medium tracking-normal p-1 md:p-0 block text-lg md:text-base"
					>
						{item.name}
					</Link>
				</li>
			</Fragment>
		);
	});
	return navLinks;
}

export default function Header() {
	const [isMobileNavCollapsed, setIsMobileNavCollapsed] = useState(true);
	return (
		<>
			<header
				id="navigation"
				className="sticky top-0 z-50 grid grid-cols-main-grid py-2 bg-onyx text-white overflow-hidden antialiased select-none"
			>
				<div className="grid grid-cols-[max-content_1fr] align-items-center col-center-content">
					<p
						className="mr-4 flex items-center text-3xl uppercase font-industrial font-medium tracking-widest md:tracking-wide lg:tracking-widest"
						onClick={() => setIsMobileNavCollapsed(true)}
					>
						<Link
							href="/"
							className="flex"
						>
							<Logo className="mr-2" /> VC Müllheim
						</Link>
					</p>
					<div className="place-self-center justify-self-end md:hidden">
						<div className={"grid [grid-template-areas:'stack'] items-center text-2xl duration-100" + (isMobileNavCollapsed ? " hover:text-turquoise" : "")}>
							<Bars
								className={"[grid-area:stack] cursor-pointer duration-500 " + (isMobileNavCollapsed ? "" : "opacity-0 rotate-[360deg] -z-1 blur-sm")}
								onClick={() => setIsMobileNavCollapsed(!isMobileNavCollapsed)}
							/>
							<Xmark
								className={"[grid-area:stack] cursor-pointer duration-500 " + (isMobileNavCollapsed ? "opacity-0 rotate-[-360deg] -z-1 blur-sm" : "")}
								onClick={() => setIsMobileNavCollapsed(!isMobileNavCollapsed)}
							/>
						</div>
					</div>
					<div className={(isMobileNavCollapsed ? "max-h-0 overflow-hidden " : "max-h-screen my-2 duration-500 ") + " " + "md:max-h-full w-full md:w-auto grid grid-flow-col gap-x-4 md:gap-x-0 col-span-2 md:col-span-1 justify-self-center md:justify-self-end justify-around md:m-0 font-systemui"}>
						<ul
							className={(isMobileNavCollapsed ? "" : "grid-flow-row ") + " md:max-h-full md:grid md:grid-flow-col gap-x-1 place-self-center"}
							onClick={() => setIsMobileNavCollapsed(true)}
						>
							{navbarLinksRender()}
						</ul>
						<ul>
							{Socials().map((socialItem) => (
								<li key={socialItem.name}>
									<Link
										{...socialItem}
										className={"hover:text-lion text-lg font-medium tracking-normal flex gap-x-1 items-center p-1 md:hidden " + (isMobileNavCollapsed ? " hidden " : "")}
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
