import { createApp } from "../app";
import notesRoutes from "./notes";
import searchRoutes from "./search";
import analyticsRoutes from "./analytics";
import tagsRoutes from "./tags";
import peopleRoutes from "./people";
import templatesRoutes from "./templates";
import transcribeRoutes from "./transcribe";
import embedRoutes from "./embed";

const routes = [
  notesRoutes,
  searchRoutes,
  analyticsRoutes,
  tagsRoutes,
  peopleRoutes,
  templatesRoutes,
  transcribeRoutes,
  embedRoutes,
 ] as const;

const app = createApp();

routes.forEach((route) => {
  app.route('/', route);
});

export type AppType = (typeof routes)[number];
export default app;
