import { config, spacesEnabled } from "./config.js";
import { sql } from "./db.js";
import { migrate } from "./migrate.js";
import { createRouter } from "./router.js";
import { HttpError, json, readJson } from "./http.js";
import { publicRoutes } from "./routes/public.js";
import { accountRoutes } from "./routes/account.js";
import { adminRoutes } from "./routes/admin.js";

const router = createRouter();
publicRoutes(router);
accountRoutes(router);
adminRoutes(router);

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};

function corsHeaders(req) {
  const origin = req.headers.get("origin");
  if (!origin || !config.corsOrigins.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new HttpError(503, "The server is busy. Please try again.")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function errorResponse(err) {
  if (err instanceof HttpError) {
    return json({ error: err.message, ...(err.details ? { details: err.details } : {}) }, err.status);
  }
  // Postgres constraint violations that slipped past validation.
  if (err?.errno === "23505" || err?.code === "23505") return json({ error: "That already exists" }, 409);
  if (err?.errno === "23514" || err?.code === "23514") return json({ error: "A value is out of range" }, 400);
  console.error("[error]", err);
  return json({ error: "Something went wrong on our side. Please try again." }, 500);
}

async function handle(req, server) {
  const url = new URL(req.url);
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const found = router.match(req.method, url.pathname);
  if (!found) return json({ error: "Not found" }, 404);
  if (found.methodNotAllowed) return json({ error: "Method not allowed" }, 405);

  const isJson = (req.headers.get("content-type") || "").includes("application/json");
  const body = ["POST", "PUT", "PATCH"].includes(req.method) && isJson ? await readJson(req) : {};

  const result = await found.handler({ req, url, params: found.params, body, server });
  return result instanceof Response ? result : json(result);
}

// Apply database migrations before accepting traffic. Retry while the DB comes up.
for (let attempt = 1; ; attempt++) {
  try {
    await migrate();
    break;
  } catch (err) {
    if (attempt >= 10) {
      console.error("[vitron-api] could not prepare the database, giving up:", err);
      process.exit(1);
    }
    console.error(`[vitron-api] database not ready (attempt ${attempt}): ${err.message}`);
    await Bun.sleep(Math.min(1000 * attempt, 5000));
  }
}

let shuttingDown = false;

const server = Bun.serve({
  port: config.port,
  hostname: "0.0.0.0",
  maxRequestBodySize: 60 * 1024 * 1024, // room for 10 x 5 MB image uploads
  idleTimeout: 30,
  async fetch(req, server) {
    const started = performance.now();
    let res;
    if (shuttingDown) {
      res = json({ error: "Server restarting, try again in a moment" }, 503);
    } else {
      try {
        const slow = new URL(req.url).pathname.startsWith("/api/admin/import/");
        res = await withTimeout(handle(req, server), slow ? 90_000 : config.requestTimeoutMs);
      } catch (err) {
        res = errorResponse(err);
      }
    }
    for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...corsHeaders(req) })) res.headers.set(k, v);
    const url = new URL(req.url);
    if (url.pathname !== "/api/health") {
      console.log(`${req.method} ${url.pathname} ${res.status} ${Math.round(performance.now() - started)}ms`);
    }
    return res;
  },
  error(err) {
    return errorResponse(err);
  },
});

console.log(`[vitron-api] listening on http://localhost:${server.port} (${config.isProd ? "production" : "development"})`);
console.log(`[vitron-api] image storage: ${spacesEnabled ? "DigitalOcean Spaces" : "local folder " + config.uploadDir}`);

// Graceful shutdown: App Platform sends SIGTERM before replacing an instance.
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[vitron-api] ${signal} received, finishing in-flight requests…`);
  await server.stop(false);
  await sql.close({ timeout: 5 });
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Log and keep running if something unexpected escapes a handler.
process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
