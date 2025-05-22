import SectionHeading from "@/components/layout/SectionHeading";
import type { Team } from "@/data/payload-types";
import { getTeams } from "@/data/teams";
import dayjs from "dayjs";
import Link from "next/link";
import { Fragment } from "react";
import {
	FaCalendarDays as IconCalendar,
	FaClock as IconClock,
	FaChevronUp as IconCollapse,
	FaUser as IconPerson,
	FaUserGroup as IconPersons,
} from "react-icons/fa6";
import MapsLink from "../MapsLink";

export default async function HomeTeams() {
	const data = await getTeams();
	const teams = data?.docs;
	if (!teams) return null;

	const numberOfTeams = teams.length;
	// turn number to requivalent word, eg. 2 = zwei
	const numToWordsDe = require("num-words-de");
	const teamNumber = numToWordsDe.numToWord(numberOfTeams, {
		uppercase: false,
		indefinite_eine: true,
	});

	return (
		<section className="col-center-content mb-6">
			<div id="mannschaften" className="scroll-anchor" />
			<SectionHeading text="Mannschaften" />
			<p className="text-center opacity-60 -mt-2 mb-3">
				Zurzeit umfasst unser Verein {teamNumber} {numberOfTeams > 1 ? "Mannschaften" : "Mannschaft"}:
			</p>
			<div className="columns-[360px_3] gap-4">
				{teams.map((team) => (
					<TeamCard {...team} key={team.id} />
				))}
			</div>
		</section>
	);
}

async function TeamCard({ id, slug, name, league, age, description, schedule, people }: Team) {
	return (
		<details
			key={id}
			className="group bg-white text-onyx rounded-sm inline-grid w-full grid-flow-row gap-2 prose-a:text-turquoise break-inside-avoid mb-4"
		>
			<summary className="select-none hover:cursor-pointer group-open:hover:cursor-default p-3 text-center md:text-left relative">
				<div className="font-bold text-xl text-blumine font-humanist group-hover:text-turquoise group-open:group-hover:text-blumine group-open:hover:cursor-pointer">
					{name}
					{league && ` - ${league}`}
					<span className="absolute right-0 pt-1 pr-3 transition-opacity duration-200 text-slate-400 group-open:text-onyx">
						<IconCollapse className="duration-200 group-open:-rotate-180 group-open:group-hover:animate-pulse" />
					</span>
				</div>
				<div className="hidden group-open:block font-normal text-left text-base hover:text-onyx *:mt-3 last:*:mb-1">
					{age && (
						<div className="leading-tight" key="alter">
							<p className="font-bold">Alter:</p>
							ab {age} Jahre
						</div>
					)}
					{schedule && (
						<div className="leading-tight">
							<p className="font-bold flex gap-x-1 items-baseline">
								<IconClock className="text-xs" />
								Trainingszeiten:
							</p>
							{schedule?.map((training) => {
								const separator = training.day.length > 2 ? ", " : " & ";

								return (
									<Fragment key={training.id}>
										<p>
											{training.day.join(separator)} {dayjs(training.time.startTime).format("HH:mm")} -{" "}
											{dayjs(training.time.endTime).format("HH:mm")} Uhr
										</p>
										{typeof training.location === "object" && <MapsLink location={training.location} />}
									</Fragment>
								);
							})}
						</div>
					)}
					{people?.coach && people.coach.length >= 1 && (
						<div className="leading-tight">
							<p className="font-bold flex gap-x-1 items-baseline">
								{people.coach.length === 1 ? <IconPerson className="text-xs" /> : <IconPersons className="text-xs" />}
								Trainer:
							</p>
							{people.coach?.map((trainer, index) => {
								if (typeof trainer !== "object") return null;
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
					{people?.contactPerson && people.contactPerson && (
						<div className="leading-tight" key="ansprechpersonen">
							<p className="font-bold flex gap-x-1 items-baseline">
								{people.contactPerson.length === 1 ? (
									<IconPerson className="text-xs" />
								) : (
									<IconPersons className="text-xs" />
								)}
								Ansprechperson:
							</p>
							{people.contactPerson?.map((person, index) => {
								if (typeof person !== "object") return null;
								return (
									<Fragment key={person.name}>
										{index !== 0 && " & "}
										{person.email ? (
											<Link href={`mailto:${person.email}`} scroll={false}>
												{person.name}
											</Link>
										) : (
											person.name
										)}
									</Fragment>
								);
							})}
						</div>
					)}

					{description && (
						<div className="leading-tight" key="kommentar">
							{description}
						</div>
					)}
					{league && (
						<div key="saisoninfo">
							<p className="font-bold flex gap-x-1 items-baseline">
								<IconCalendar className="text-xs" />
								Saisoninfo:
							</p>
							<Link href={`/teams/${slug}`} className="inline-flex gap-x-1 items-baseline">
								Spielplan, Tabelle & Kader
							</Link>
						</div>
					)}
				</div>
			</summary>
		</details>
	);
}
