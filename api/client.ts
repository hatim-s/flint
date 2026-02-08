import { hc } from "hono/client";
import type { AppType } from "./routes";

const api = hc<AppType>("/api/v1");

function createServerClient(headers: Headers) {
  return hc<AppType>("/api/v1", {
    headers: Object.fromEntries(headers.entries()),
  });
}

export { api, createServerClient };
