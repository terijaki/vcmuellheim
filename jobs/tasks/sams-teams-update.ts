import { cronSamsTeamsViaLeaguesUpdate } from "@/data/sams/sams-server-actions";
import { Cron } from "croner";

export const samsTeamsUpdateTask = new Cron(
	"0 3 * * *", // every day at 3 AM
	{
		name: "Sams Team Update",
		paused: true,
		protect: true,
		interval: 60 * 60 * 24, // maximum every 24 hours
	},
	async () => {
		try {
			const updateTask = await cronSamsTeamsViaLeaguesUpdate();
			if (!updateTask) throw "No data returned from cronSamsTeamsViaLeaguesUpdate().";

			console.info("🟢 Sams Team Update completed successfully.", updateTask);
		} catch (error) {
			console.error("🟠 Error during Sams Team Update:", error);
		}
	},
);
