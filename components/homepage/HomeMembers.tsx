import SectionHeading from "@/components/layout/SectionHeading";
import { getMembers } from "@/data/members";
import type { Member, Role } from "@/data/payload-types";
import { shuffleArray } from "@/utils/shuffleArray";

export default async function HomeMembers() {
	// get the data
	const members = await getMembers();
	if (!members) return null;

	// split members by role
	const isBoardMember = (role: string | Role) => typeof role === "object" && role.vorstand === true;
	const isTrainer = (role: string | Role) => typeof role === "object" && role.name.toLowerCase().includes("trainer");
	const boardMembers = members?.docs
		.map((member) => ({
			...member,
			roles: member.roles?.filter(isBoardMember),
		}))
		.filter((member) => member.roles && member.roles.length > 0);
	const trainers = members?.docs
		.map((member) => ({
			...member,
			roles: member.roles?.filter(isTrainer),
		}))
		.filter((member) => member.roles && member.roles.length > 0);

	const otherMembers = members?.docs
		.map((member) => ({
			...member,
			roles: member.roles?.filter((role) => !isTrainer(role) && !isBoardMember(role)),
		}))
		.filter((member) => member.roles && member.roles.length > 0);

	return (
		<section className="col-full-content sm:col-center-content pb-12">
			<div id="verein" className="scroll-anchor" />
			{boardMembers.length > 0 && (
				<>
					<SectionHeading text="Vorstand" />
					<MemberList members={boardMembers} />
				</>
			)}
			{trainers.length > 0 && (
				<>
					<SectionHeading text="Trainer & Betreuer" classes="mt-8" />
					<MemberList members={shuffleArray(trainers)} />
				</>
			)}
			{otherMembers.length > 0 && (
				<>
					<SectionHeading text="Sonstige Funktionäre" classes="mt-8" />
					<MemberList members={otherMembers} />
				</>
			)}
		</section>
	);
}

function MemberList({ members }: { members: Member[] }) {
	return (
		<div className="member-list grid gap-4 grid-cols-[repeat(auto-fit,minmax(160px,min-content))] sm:grid-cols-[repeat(auto-fit,minmax(200px,min-content))] justify-center">
			{members?.map((member) => {
				return <MemberCard key={member.id} member={member} />;
			})}
		</div>
	);
}

import Image from "next/image";
import Link from "next/link";
import { FaUser as IconAvatar } from "react-icons/fa6";

async function MemberCard({ member }: { member: Member }) {
	const { id, name, email, avatar, roles } = member;

	const emailClass = !email ? " hover:cursor-default" : "";
	const roleNames = roles?.map((role) => (typeof role === "object" ? role.name : role));
	const avatarUrl = avatar && typeof avatar === "object" ? avatar.url : avatar;

	return (
		<Link
			data-member-id={id}
			className={`member-card grid grid-cols-[4rem,1fr] sm:grid-cols-[5rem,1fr] justify-items-start place-items-center bg-white rounded-2xl shadow overflow-hidden group text-sm sm:text-base select-none${emailClass}`}
			href={email ? `mailto:${email}` : ""}
			scroll={false}
		>
			<div className="overflow-hidden w-full h-full aspect-square group bg-lion *:h-full *:w-full *:group-hover:scale-105 *:duration-300">
				{avatarUrl ? (
					<Image width={96} height={96} src={avatarUrl} alt={name} className="object-cover" />
				) : (
					<IconAvatar className="text-white mt-3" />
				)}
			</div>
			<div className="grid grid-cols-1 overflow-hidden w-full px-2">
				<div className="">{name}</div>
			</div>
			{roles && (
				<div className="bg-blumine text-white w-full h-full hyphens-auto text-xs text-center col-span-2">
					{roleNames?.join(", ")}
				</div>
			)}
		</Link>
	);
}
