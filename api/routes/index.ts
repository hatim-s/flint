import { createApp } from "../app";
import analyticsRoutes from "./analytics";
import embedRoutes from "./embed";
import notesRoutes from "./notes";
import peopleRoutes from "./people";
import searchRoutes from "./search";
import tagsRoutes from "./tags";
import templatesRoutes from "./templates";
import transcribeRoutes from "./transcribe";

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
  app.route("/api/v1", route);
});

export type AppType = (typeof routes)[number];
export default app;
