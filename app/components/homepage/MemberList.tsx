import React from "react";
import MemberCard from "@/app/components/ui/MemberCard";
import { getMembers } from "@/app/utils/getMembers";

export default function ListMembers(props: { memberType: "board" | "trainers"; random?: false | true }) {
	return (
		<div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,max-content))] justify-center">
			{getMembers(props.memberType, props.random).map((member) => {
				return (
					<MemberCard
						{...member}
						key={member.name}
					/>
				);
			})}
		</div>
	);
}
