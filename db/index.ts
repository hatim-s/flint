import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

config({ path: ".env.local" });

// biome-ignore lint/style/noNonNullAssertion: should exist for the db to work
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, { schema });
