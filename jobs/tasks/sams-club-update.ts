import { samsTeamsUpdate } from "@/utils/sams/sams-server-actions";
import { Cron } from "croner";

export const samsClubUpdate = new Cron(
	"0 3 * * *", // every day at 3 AM
	{
		name: "Sams Club Update",
		paused: true,
		protect: true,
		interval: 60 * 60 * 12, // maximum every 12 hours
	},
	async () => {
		try {
			const updateTask = await samsTeamsUpdate();
			if (!updateTask) throw "No data returned from samsTeamsUpdate().";

			console.info("🟢 Sams Club Update completed successfully.", updateTask);
		} catch (error) {
			console.error("🟠 Error during Sams Club Update:", error);
		}
	},
);
