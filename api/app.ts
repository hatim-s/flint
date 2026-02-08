import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { requestId } from "hono/request-id";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { auth } from "@/auth";
import { NOT_FOUND, INTERNAL_SERVER_ERROR, UNAUTHORIZED } from "@/api/lib/http-status-codes";

type AppBindings = {
  Variables: {
    session: Awaited<ReturnType<typeof auth.api.getSession>>;
    userId: string;
  };
};

const authMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Unauthorized" }, UNAUTHORIZED);
  }

  c.set("session", session);
  c.set("userId", session.user.id);
  return await next();
};

function createApp() {
  const app = new Hono<AppBindings>({
    strict: false
  });

  app.use("*", authMiddleware).use(requestId()).use(logger()).use(cors());

  // we want json responses for all errors
  app.notFound((c) => c.json({ error: "Not Found" }, NOT_FOUND));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "Internal Server Error" }, INTERNAL_SERVER_ERROR);
  });

  return app;
}

export { authMiddleware, createApp };
export type { AppBindings };


