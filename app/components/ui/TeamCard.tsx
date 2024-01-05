import Link from "next/link";
import { Fragment } from "react";
import { teamObject } from "@/app/utils/getTeams";
import {
	FaCircleXmark as IconXmark,
	FaChevronDown as IconExpand,
	FaChevronUp as IconCollapse,
	FaCalendarDays as IconCalendar,
	FaUser as IconPerson,
	FaUserGroup as IconPersons,
	FaClock as IconClock,
} from "react-icons/fa6";
import { getLeagueName } from "@/app/utils/sams/jsonClubData";
import Markdown from "react-markdown";

export default function TeamCard(props: teamObject) {
	let liga;
	if (props.sbvvId) {
		liga = getLeagueName(props.sbvvId).replace("Herren", "").replace("Damen", "").replace("Nord", "").replace("Ost", "").replace("Süd", "").replace("West", "");
	}

	return (
		<details className="group bg-white text-onyx rounded-sm inline-grid w-full grid-flow-row gap-2 prose-a:text-turquoise break-inside-avoid mb-4">
			<summary className="select-none hover:cursor-pointer group-open:hover:cursor-auto p-3 text-center md:text-left relative">
				<div className="font-bold text-xl text-blumine font-humanist group-hover:text-turquoise group-open:group-hover:text-blumine group-open:hover:cursor-pointer">
					{props.title}
					{liga && " - " + liga}
					{/* fetch Liga name via sbvv_id */}
					<span className="absolute right-0 pt-1 pr-3 transition-opacity duration-200 text-slate-400 group-open:text-onyx">
						<IconCollapse className="duration-200 group-open:-rotate-180 group-open:group-hover:animate-pulse" />
					</span>
					{/* <span className="absolute right-0 pr-3 transition-opacity  group-open:duration-200 opacity-100 group-open:opacity-0">
						<IconExpand className="text-slate-400 rotate-180" />
					</span> */}
				</div>
				<div className="hidden group-open:block font-normal text-left text-base hover:text-onyx *:mt-3 last:*:mb-1">
					{props.alter && (
						<div
							className="leading-tight"
							key="alter"
						>
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
							{props.training?.map((training) => {
								return (
									<Fragment key="trainingszeiten">
										<p>{training.zeit}</p>
										<Link
											href={"" + training.map}
											target="_blank"
											scroll={false}
										>
											{training.ort}
										</Link>
									</Fragment>
								);
							})}
						</div>
					)}
					{props.trainer && (
						<div
							className="leading-tight"
							key="trainers"
						>
							<p className="font-bold flex gap-x-1 items-baseline">
								{props.trainer.length == 1 ? <IconPerson className="text-xs" /> : <IconPersons className="text-xs" />}
								Trainer:
							</p>
							{props.trainer?.map((trainer, index) => {
								return (
									<Fragment key="trainer">
										{index != 0 && " & "}
										<Link
											href={"mailto:" + trainer.email}
											scroll={false}
										>
											{trainer.name}
										</Link>
									</Fragment>
								);
							})}
						</div>
					)}
					{props.ansprechperson && (
						<div
							className="leading-tight"
							key="ansprechpersonen"
						>
							<p className="font-bold flex gap-x-1 items-baseline">
								{props.ansprechperson.length == 1 ? <IconPerson className="text-xs" /> : <IconPersons className="text-xs" />}
								Ansprechperson:
							</p>
							{props.ansprechperson?.map((ansprechperson, index) => {
								return (
									<Fragment key="ansprechperson">
										{index != 0 && " & "}
										<Link href={"mailto:" + ansprechperson.email}>{ansprechperson.name}</Link>
									</Fragment>
								);
							})}
						</div>
					)}

					{props.kommentar && (
						<div
							className="leading-tight"
							key="kommentar"
						>
							<Markdown>{props.kommentar}</Markdown>
						</div>
					)}
					{liga && (
						<div key="saisoninfo">
							<p className="font-bold flex gap-x-1 items-baseline">
								<IconCalendar className="text-xs" />
								Saisoninfo:
							</p>
							<Link
								href={"/teams/" + props.slug}
								className="inline-flex gap-x-1 items-baseline"
							>
								Ergebnisse, Tabelle & Kalender
							</Link>
						</div>
					)}
				</div>
			</summary>
		</details>
	);
}
