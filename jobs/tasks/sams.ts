import { samsClubData } from "@/utils/sams/sams-server-actions";
import type { TaskConfig } from "payload";

export const SamsClubUpdate: TaskConfig = {
	slug: "samsClubUpdate",
	label: "SAMS Club Update",
	retries: 0,
	outputSchema: [
		{
			name: "status",
			type: "text",
		},
	],
	handler: async () => {
		try {
			const data = await samsClubData(1);

			console.log("🚀 SAMS Club Update started", data);

			return { output: { status: "SAMS Club Update performed. All good. ✌️" } };
		} catch (error) {
			return { output: { status: `SAMS Club Update failed: ${error}` } };
		}
	},
};
