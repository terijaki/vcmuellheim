import type { getTeams } from "@/app/utils/getTeams";
import { samsClubData } from "@/app/utils/sams/sams-server-actions";
import { unstable_cacheLife as cacheLife } from "next/cache";
import Link from "next/link";
import { Fragment } from "react";
import {
	FaCalendarDays as IconCalendar,
	FaClock as IconClock,
	FaChevronUp as IconCollapse,
	FaUser as IconPerson,
	FaUserGroup as IconPersons,
} from "react-icons/fa6";
import Markdown from "react-markdown";

export default async function TeamCard(props: Awaited<ReturnType<typeof getTeams>>[number]) {
	"use cache";
	cacheLife("hours");


	const clubData = await samsClubData();
	const leagueName = clubData?.teams?.team
		.find((t) => t.id === props.sbvvId)
		?.matchSeries?.name.replace("Herren", "")
		.replace("Damen", "")
		.replace("Nord", "")
		.replace("Ost", "")
		.replace("Süd", "")
		.replace("West", "");

	return (
		<details className="group bg-white text-onyx rounded-sm inline-grid w-full grid-flow-row gap-2 prose-a:text-turquoise break-inside-avoid mb-4">
			<summary className="select-none hover:cursor-pointer group-open:hover:cursor-auto p-3 text-center md:text-left relative">
				<div className="font-bold text-xl text-blumine font-humanist group-hover:text-turquoise group-open:group-hover:text-blumine group-open:hover:cursor-pointer">
					{props.title}
					{leagueName && ` - ${leagueName}`}
					<span className="absolute right-0 pt-1 pr-3 transition-opacity duration-200 text-slate-400 group-open:text-onyx">
						<IconCollapse className="duration-200 group-open:-rotate-180 group-open:group-hover:animate-pulse" />
					</span>
					{/* <span className="absolute right-0 pr-3 transition-opacity  group-open:duration-200 opacity-100 group-open:opacity-0">
						<IconExpand className="text-slate-400 rotate-180" />
					</span> */}
				</div>
				<div className="hidden group-open:block font-normal text-left text-base hover:text-onyx *:mt-3 last:*:mb-1">
					{props.alter && (
						<div className="leading-tight" key="alter">
							{/* <p className="font-bold">Alter:</p> */}
							{props.alter}
						</div>
					)}
					{props.training && (
						<div className="leading-tight">
							<p className="font-bold flex gap-x-1 items-baseline">
								<IconClock className="text-xs" />
								Trainingszeiten:
							</p>
							{props.training?.map((training, index) => {
								return (
									<Fragment key={training.zeit}>
										<p>{training.zeit}</p>
										<Link href={`${training.map}`} target="_blank" scroll={false}>
											{training.ort}
										</Link>
									</Fragment>
								);
							})}
						</div>
					)}
					{props.trainer && props.trainer.length >= 1 && (
						<div className="leading-tight">
							<p className="font-bold flex gap-x-1 items-baseline">
								{props.trainer.length === 1 ? <IconPerson className="text-xs" /> : <IconPersons className="text-xs" />}
								Trainer:
							</p>
							{props.trainer?.map((trainer, index) => {
								return (
									<Fragment key={trainer.name}>
										{index !== 0 && " & "}
										{trainer.email ? (
											<Link href={`mailto:${trainer.email}`} scroll={false}>
												{trainer.name}
											</Link>
										) : (
											trainer.name
										)}
									</Fragment>
								);
							})}
						</div>
					)}
					{props.ansprechperson && (
						<div className="leading-tight" key="ansprechpersonen">
							<p className="font-bold flex gap-x-1 items-baseline">
								{props.ansprechperson.length === 1 ? (
									<IconPerson className="text-xs" />
								) : (
									<IconPersons className="text-xs" />
								)}
								Ansprechperson:
							</p>
							{props.ansprechperson?.map((ansprechperson, index) => {
								return (
									<Fragment key={ansprechperson.name}>
										{index !== 0 && " & "}
										<Link href={`mailto:${ansprechperson.email}`}>{ansprechperson.name}</Link>
									</Fragment>
								);
							})}
						</div>
					)}

					{props.kommentar && (
						<div className="leading-tight" key="kommentar">
							<Markdown>{props.kommentar}</Markdown>
						</div>
					)}
					{leagueName && (
						<div key="saisoninfo">
							<p className="font-bold flex gap-x-1 items-baseline">
								<IconCalendar className="text-xs" />
								Saisoninfo:
							</p>
							<Link href={`/teams/${props.slug}`} className="inline-flex gap-x-1 items-baseline">
								Spielplan, Tabelle & Kader
							</Link>
						</div>
					)}
				</div>
			</summary>
		</details>
	);
}
