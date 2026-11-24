import { badRequest } from "./http.js";

// Accepts 07XXXXXXXX, 01XXXXXXXX, 7XXXXXXXX, 2547..., +2547... and returns +254XXXXXXXXX.
export function normalizePhone(raw) {
  if (raw == null) return null;
  const p = String(raw).replace(/[\s\-()]/g, "");
  let m;
  if ((m = p.match(/^\+?254([17]\d{8})$/))) return "+254" + m[1];
  if ((m = p.match(/^0([17]\d{8})$/))) return "+254" + m[1];
  if ((m = p.match(/^([17]\d{8})$/))) return "+254" + m[1];
  return null;
}

/**
 * Tiny field reader. Collects every problem so the user sees all errors at once.
 *   const v = fields(body);
 *   const name = v.str("fullName", { label: "Full name", min: 2, max: 100 });
 *   v.done();   // throws 400 with { field: message } if anything failed
 */
export function fields(body) {
  const errors = {};
  const fail = (key, msg) => { if (!errors[key]) errors[key] = msg; };
  const has = (key) => body[key] !== undefined && body[key] !== null && body[key] !== "";

  return {
    errors,
    has,
    fail,
    str(key, { label = key, required = true, min = 0, max = 500, trim = true } = {}) {
      if (!has(key)) {
        if (required) fail(key, `${label} is required`);
        return null;
      }
      if (typeof body[key] !== "string" && typeof body[key] !== "number") {
        fail(key, `${label} must be text`);
        return null;
      }
      const s = trim ? String(body[key]).trim() : String(body[key]);
      if (required && s.length === 0) fail(key, `${label} is required`);
      else if (s.length < min) fail(key, `${label} must be at least ${min} characters`);
      else if (s.length > max) fail(key, `${label} must be at most ${max} characters`);
      return s || null;
    },
    int(key, { label = key, required = true, min = 0, max = 100_000_000 } = {}) {
      if (!has(key)) {
        if (required) fail(key, `${label} is required`);
        return null;
      }
      const n = Number(body[key]);
      if (!Number.isInteger(n)) { fail(key, `${label} must be a whole number`); return null; }
      if (n < min || n > max) { fail(key, `${label} must be between ${min} and ${max}`); return null; }
      return n;
    },
    bool(key, fallback = false) {
      return has(key) ? body[key] === true || body[key] === "true" : fallback;
    },
    oneOf(key, options, { label = key, required = true, fallback = null } = {}) {
      if (!has(key)) {
        if (required) fail(key, `${label} is required`);
        return fallback;
      }
      if (!options.includes(body[key])) { fail(key, `${label} must be one of: ${options.join(", ")}`); return fallback; }
      return body[key];
    },
    phone(key, { label = "Phone number", required = true } = {}) {
      if (!has(key)) {
        if (required) fail(key, `${label} is required`);
        return null;
      }
      const p = normalizePhone(body[key]);
      if (!p) fail(key, `${label} must be a valid Kenyan number, e.g. 0712345678`);
      return p;
    },
    email(key, { label = "Email", required = false } = {}) {
      const s = this.str(key, { label, required, max: 200 });
      if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail(key, `${label} looks invalid`);
      return s ? s.toLowerCase() : null;
    },
    password(key, { label = "Password", required = true } = {}) {
      return this.str(key, { label, required, min: 6, max: 200, trim: false });
    },
    done() {
      if (Object.keys(errors).length) {
        throw badRequest(Object.values(errors)[0], errors);
      }
    },
  };
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

export function parseId(raw) {
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) throw badRequest("Invalid id");
  return n;
}
