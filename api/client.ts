import { hc } from "hono/client";
import type { AppType } from "./routes";

const api = hc<AppType>("/api");

function createServerClient(headers: Headers) {
  return hc<AppType>("/api", {
    headers: Object.fromEntries(headers.entries()),
  });
}

export { api, createServerClient };
