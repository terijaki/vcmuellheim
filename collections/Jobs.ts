import { isAdmin } from "@/data/payload-access";
// import { SamsClubUpdate } from "@/jobs/tasks/sams";
import type { JobsConfig } from "payload";

export const Jobs: JobsConfig = {
	// tasks: [SamsClubUpdate],
	autoRun: [
		{
			cron: "0/1 * * * *", // every hour at minute 0
			limit: 100, // limit jobs to process each run
			queue: "hourly", // name of the queue
		},
	],
	deleteJobOnComplete: false, // do not delete jobs after completion
	jobsCollectionOverrides: ({ defaultJobsCollection }) => {
		if (!defaultJobsCollection.admin) {
			defaultJobsCollection.admin = {};
		}
		defaultJobsCollection.admin.hidden = false;
		if (!defaultJobsCollection.access) {
			defaultJobsCollection.access = { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin };
		}
		return defaultJobsCollection;
	},
};
