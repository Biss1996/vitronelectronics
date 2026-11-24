// All configuration comes from environment variables (Bun loads .env automatically).

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const isProd = process.env.NODE_ENV === "production";

const jwtSecret = process.env.JWT_SECRET || (isProd ? required("JWT_SECRET") : "dev-only-secret-change-me");
if (isProd && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters in production");
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  databaseUrl: required("DATABASE_URL"),
  dbPoolMax: Number(process.env.DB_POOL_MAX) || 10,
  jwtSecret,
  jwtTtlSeconds: 60 * 60 * 24 * 7, // 7 days
  // Comma-separated list of allowed browser origins. Not needed when the frontend
  // and API share a domain (the default setup on DigitalOcean and in local dev).
  corsOrigins: (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS) || 15000,
  spaces: {
    key: process.env.SPACES_KEY || "",
    secret: process.env.SPACES_SECRET || "",
    bucket: process.env.SPACES_BUCKET || "",
    region: process.env.SPACES_REGION || "fra1",
    endpoint: process.env.SPACES_ENDPOINT || "",          // e.g. https://fra1.digitaloceanspaces.com
    publicUrl: (process.env.SPACES_PUBLIC_URL || "").replace(/\/$/, ""), // e.g. https://bucket.fra1.cdn.digitaloceanspaces.com
  },
  uploadDir: process.env.UPLOAD_DIR || "./uploads",
  maxUploadBytes: 5 * 1024 * 1024,
};

export const spacesEnabled = Boolean(
  config.spaces.key && config.spaces.secret && config.spaces.bucket && config.spaces.endpoint,
);
