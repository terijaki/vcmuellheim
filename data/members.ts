"server-only"
import { payload } from "./payload-client";

export async function getMembers() {
	try {
		const members = await payload.find({
			collection: "members",
			limit: 100,
			sort: "-name",
		});

		if (members) return members;
	} catch (error) {
		console.error("Error fetching members:", error);
	}
}

export async function getMembersByRole(roles: string[]) {
	try {
		const members = await payload.find({
			collection: "members",
			limit: 100,
			sort: "-name",
			where: {
				"roles.name": { in: roles },
			},
		});

		if (members) return members;
	} catch (error) {
		console.error("Error fetching members:", error);
	}
}
