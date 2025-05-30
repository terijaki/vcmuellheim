import { Cron } from "croner";

export const samsClubUpdate = new Cron(
	"*/1 * * * *", // every minute
	() => {
		try {
			console.log("This will run every fifth second 🦋");
		} catch (error) {
			console.error("Error during Sams Club update:", error);
		}
	},
	
);
