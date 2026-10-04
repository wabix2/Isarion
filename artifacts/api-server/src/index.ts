import app from "./app";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./lib/logger";
import { findMigrationsDir, runMigrations } from "./lib/run-migrations";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Create/upgrade tables automatically on startup (set RUN_MIGRATIONS=false to skip).
// A failure is logged but does not stop the server from starting.
async function migrate(): Promise<void> {
  if (process.env["RUN_MIGRATIONS"] === "false") return;
  const dir = findMigrationsDir();
  if (!dir) {
    logger.warn("Migrations folder not found; skipping automatic migrations");
    return;
  }
  try {
    const applied = await runMigrations(
      (text) => db.execute(sql.raw(text)),
      async (text) => (await db.execute(sql.raw(text))) as unknown as { rows: { name: string }[] },
      dir,
    );
    logger.info({ applied }, "Database migrations checked");
  } catch (err) {
    logger.error({ err }, "Database migration failed");
  }
}

await migrate();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
