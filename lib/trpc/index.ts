/**
 * Main tRPC app router - combines all entity routers
 */

import { eventsRouter } from "./routers/events";
import { mediaRouter } from "./routers/media";
import { membersRouter } from "./routers/members";
import { newsRouter } from "./routers/news";
import { sponsorsRouter } from "./routers/sponsors";
import { teamsRouter } from "./routers/teams";
import { busRouter } from "./routers/bus";
import { router } from "./trpc";

export const appRouter = router({
	news: newsRouter,
	events: eventsRouter,
	teams: teamsRouter,
	members: membersRouter,
	media: mediaRouter,
	sponsors: sponsorsRouter,
  bus: busRouter,
});

export type AppRouter = typeof appRouter;
