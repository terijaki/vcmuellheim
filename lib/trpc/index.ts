/**
 * Main tRPC app router - combines all entity routers
 */

import { busRouter } from "./routers/bus";
import { configRouter } from "./routers/config";
import { eventsRouter } from "./routers/events";
import { locationsRouter } from "./routers/locations";
import { mediaRouter } from "./routers/media";
import { membersRouter } from "./routers/members";
import { newsRouter } from "./routers/news";
import { samsTeamsRouter } from "./routers/samsTeams";
import { sponsorsRouter } from "./routers/sponsors";
import { teamsRouter } from "./routers/teams";
import { uploadRouter } from "./routers/upload";
import { router } from "./trpc";

export const appRouter = router({
	config: configRouter,
	news: newsRouter,
	events: eventsRouter,
	teams: teamsRouter,
	members: membersRouter,
	media: mediaRouter,
	sponsors: sponsorsRouter,
	locations: locationsRouter,
	bus: busRouter,
	samsTeams: samsTeamsRouter,
	upload: uploadRouter,
});

export type AppRouter = typeof appRouter;
