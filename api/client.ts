import { hc } from "hono/client";
import type { AppType } from "./routes";

export const api = hc<AppType>("/api");

export function createServerClient(headers: Headers) {
  return hc<AppType>("/api", {
    headers: Object.fromEntries(headers.entries()),
  });
}
