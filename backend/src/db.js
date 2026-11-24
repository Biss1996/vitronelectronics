import { SQL } from "bun";
import { config } from "./config.js";

// One shared connection pool for the whole process.
export const sql = new SQL(config.databaseUrl, {
  max: config.dbPoolMax,
  idleTimeout: 30,        // seconds before an idle connection is closed
  maxLifetime: 60 * 30,   // recycle connections every 30 min
  connectionTimeout: 10,  // seconds to wait for a new connection
});

/** Quick connectivity check used by /api/health. */
export async function pingDb(timeoutMs = 3000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("db ping timeout")), timeoutMs);
  });
  try {
    await Promise.race([sql`SELECT 1`, timeout]);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/** Serialize a value for a JSONB column. */
export const json = (v) => JSON.stringify(v ?? null);
