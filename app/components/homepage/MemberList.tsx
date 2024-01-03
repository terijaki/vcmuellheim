import React from "react";
import MemberCard from "@/app/components/ui/MemberCard";
import { getMembers } from "@/app/utils/getMembers";

export default function ListMembers(props: { memberType: "board" | "trainers"; random?: false | true }) {
	return (
		<div className="member-list grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,min-content))] justify-center">
			{getMembers(props.memberType, props.random).map((member) => {
				return (
					<MemberCard
						key={member.name}
						{...member}
					/>
				);
			})}
		</div>
	);
}
