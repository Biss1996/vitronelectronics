import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";
import { sql } from "./db.js";
import { forbidden, unauthorized } from "./http.js";

/* ---------------- Passwords (argon2id via Bun) ---------------- */

export const hashPassword = (pw) => Bun.password.hash(pw);           // argon2id
export const verifyPassword = (pw, hash) => Bun.password.verify(pw, hash).catch(() => false);

/* ---------------- JWT (HS256) ---------------- */

const b64url = (buf) => Buffer.from(buf).toString("base64url");
const sign = (data) => createHmac("sha256", config.jwtSecret).update(data).digest("base64url");

export function issueToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ sub: String(user.id), role: user.role, iat: now, exp: now + config.jwtTtlSeconds }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

export function verifyToken(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = Buffer.from(sign(`${header}.${payload}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

/* ---------------- Request auth ---------------- */

/**
 * Returns the signed-in user, or null. The user is re-read from the database on
 * every request, so disabling an account or changing a role takes effect at once.
 */
export async function getUser(req) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Bearer ")) return null;
  const claims = verifyToken(h.slice(7));
  if (!claims) return null;
  const [user] = await sql`
    SELECT id, full_name, phone, email, role, active, created_at
    FROM users WHERE id = ${Number(claims.sub)}`;
  if (!user || !user.active) return null;
  return user;
}

/**
 * Role permissions.
 *  - customer: own orders and profile
 *  - staff:    run the shop day to day — orders, stock levels, customers, dashboard
 *  - admin:    everything staff can do + products, categories, settings, staff accounts
 */
export const PERMISSIONS = {
  "dashboard:view": ["staff", "admin"],
  "orders:view": ["staff", "admin"],
  "orders:update": ["staff", "admin"],
  "customers:view": ["staff", "admin"],
  "products:view": ["staff", "admin"],
  "stock:update": ["staff", "admin"],
  "products:write": ["admin"],
  "categories:write": ["admin"],
  "uploads:write": ["admin"],
  "settings:write": ["admin"],
  "users:manage": ["admin"],
};

export const can = (user, permission) => Boolean(user && PERMISSIONS[permission]?.includes(user.role));

export async function requireUser(req) {
  const user = await getUser(req);
  if (!user) throw unauthorized();
  return user;
}

export async function requirePermission(req, permission) {
  const user = await requireUser(req);
  if (!can(user, permission)) throw forbidden();
  return user;
}

export function publicUser(u) {
  return {
    id: u.id,
    fullName: u.full_name,
    phone: u.phone,
    email: u.email,
    role: u.role,
    permissions: Object.keys(PERMISSIONS).filter((p) => can(u, p)),
    createdAt: u.created_at,
  };
}
