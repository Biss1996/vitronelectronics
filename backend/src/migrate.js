import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "./db.js";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "migrations");
const LOCK_ID = 727274; // arbitrary constant for pg_advisory_lock

/**
 * Use "public" if we may create tables there; otherwise create and use our own
 * "vitron" schema (db.js puts it first on the search_path).
 */
async function ensureSchema(tx, log) {
  const [{ vitron }] = await tx`SELECT to_regnamespace('vitron') IS NOT NULL AS vitron`;
  if (vitron) return;
  const [{ ok }] = await tx`SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS ok`;
  if (ok) return;
  try {
    await tx`CREATE SCHEMA vitron AUTHORIZATION CURRENT_USER`;
    log("[migrate] schema \"public\" is read-only for this user; using schema \"vitron\"");
  } catch (err) {
    throw new Error(
      `The database user can't create tables in schema "public" or create a "vitron" schema (${err.message}). ` +
      `Grant it CREATE on the database or on schema public.`,
    );
  }
}

/**
 * Applies any migrations/*.sql files that haven't run yet, in filename order.
 * Safe to call on every boot and from several instances at once (advisory lock).
 */
export async function migrate({ log = console.log } = {}) {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK_ID})`;
    await ensureSchema(tx, log);
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    const done = new Set((await tx`SELECT name FROM schema_migrations`).map((r) => r.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const body = await Bun.file(join(MIGRATIONS_DIR, file)).text();
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
      log(`[migrate] applied ${file}`);
    }
  });
}

if (import.meta.main) {
  try {
    await migrate();
    console.log("[migrate] database is up to date");
    await sql.close();
  } catch (err) {
    console.error("[migrate] failed:", err);
    process.exit(1);
  }
}
