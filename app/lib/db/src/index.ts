import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema/index.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required by @workspace/db.");
}

const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
export * from "./schema/index.ts";