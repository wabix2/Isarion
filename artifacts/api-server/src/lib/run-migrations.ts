import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type ExecSql = (text: string) => Promise<unknown>;

/** Finds lib/db/migrations whether the server starts from the repo root or from artifacts/api-server. */
export function findMigrationsDir(cwd: string = process.cwd(), override = process.env.MIGRATIONS_DIR): string | null {
  const candidates = [
    override,
    path.resolve(cwd, "lib/db/migrations"),
    path.resolve(cwd, "../../lib/db/migrations"),
  ].filter((p): p is string => Boolean(p));
  return candidates.find((p) => existsSync(p)) ?? null;
}

/**
 * Applies every `*.sql` file in order, once each, recording applied names in
 * `schema_migrations`. All migration files are written to be idempotent
 * (IF NOT EXISTS / ON CONFLICT), so databases where some files were already
 * run by hand are safe. Each file and its bookkeeping row run as a single
 * multi-statement query, i.e. atomically.
 */
export async function runMigrations(
  exec: ExecSql,
  query: (text: string) => Promise<{ rows: { name: string }[] }>,
  dir: string,
): Promise<string[]> {
  await exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamp NOT NULL DEFAULT now())`,
  );
  const done = new Set((await query(`SELECT name FROM schema_migrations`)).rows.map((r) => r.name));
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const text = readFileSync(path.join(dir, file), "utf8");
    const safeName = file.replace(/'/g, "''");
    await exec(`${text}\n;\nINSERT INTO schema_migrations (name) VALUES ('${safeName}') ON CONFLICT DO NOTHING;`);
    applied.push(file);
  }
  return applied;
}
