import React from "react";
import MemberCard from "@/app/components/ui/MemberCard";
import { getMembers } from "@/app/utils/getMembers";

export default function ListMembers(props: { memberType: "board" | "trainers"; random?: false | true }) {
	return (
		<div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(160px,max-content))] md:grid-cols-[repeat(auto-fit,minmax(250px,max-content))] justify-center">
			{getMembers(props.memberType).map((member) => {
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
