import { cronSamsClubsUpdate } from "@/data/sams/sams-server-actions";
import { Cron } from "croner";

export const samsClubsUpdateTask = new Cron(
	"0 2 * * *", // every day at 2 AM
	{
		name: "Sams Club Update",
		paused: true,
		protect: true,
		interval: 60 * 60 * 24 * 2, // maximum every 2 days
	},
	async () => {
		try {
			const updateTask = await cronSamsClubsUpdate();
			if (!updateTask) throw "No data returned from cronSamsClubsUpdate().";

			console.info("🟢 Sams Club Update completed successfully.", updateTask);
		} catch (error) {
			console.error("🟠 Error during Sams Club Update:", error);
		}
	},
);
