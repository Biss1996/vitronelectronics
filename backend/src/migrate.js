import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "./db.js";

const MIGRATIONS_DIR = join(import.meta.dir, "..", "migrations");
const LOCK_ID = 727274; // arbitrary constant for pg_advisory_lock

/**
 * Applies any migrations/*.sql files that haven't run yet, in filename order.
 * Safe to call on every boot and from several instances at once (advisory lock).
 */
export async function migrate({ log = console.log } = {}) {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${LOCK_ID})`;
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
