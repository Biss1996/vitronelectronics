import { sql } from "../db.js";
import { hashPassword, verifyPassword, issueToken, publicUser, requireUser } from "../auth.js";
import { HttpError, conflict, notFound, unauthorized, clientIp } from "../http.js";
import { rateLimit } from "../ratelimit.js";
import { fields } from "../validate.js";
import { listOrders, loadOrder } from "../orders.js";

// A dummy hash so failed logins for unknown phones take as long as real ones.
const DUMMY_HASH = await Bun.password.hash("not-a-real-password");

export function accountRoutes(r) {
  r.post("/api/auth/register", async ({ req, body, server }) => {
    rateLimit(`register:${clientIp(req, server)}`, { max: 10, windowMs: 60 * 60_000 });
    const v = fields(body);
    const fullName = v.str("fullName", { label: "Full name", min: 2, max: 100 });
    const phone = v.phone("phone");
    const email = v.email("email");
    const password = v.password("password");
    v.done();

    const [exists] = await sql`SELECT id FROM users WHERE phone = ${phone}`;
    if (exists) throw conflict("This phone number is already registered. Please sign in.");

    const hash = await hashPassword(password);
    const user = await sql.begin(async (tx) => {
      const [u] = await tx`
        INSERT INTO users (full_name, phone, email, password_hash)
        VALUES (${fullName}, ${phone}, ${email}, ${hash})
        RETURNING id, full_name, phone, email, role, active, created_at`;
      // Attach any earlier guest orders placed with this phone number.
      await tx`UPDATE orders SET user_id = ${u.id} WHERE phone = ${phone} AND user_id IS NULL`;
      return u;
    });
    return { user: publicUser(user), token: issueToken(user) };
  });

  r.post("/api/auth/login", async ({ req, body, server }) => {
    const v = fields(body);
    const phone = v.phone("phone");
    const password = v.str("password", { label: "Password", trim: false, max: 200 });
    v.done();
    rateLimit(`login:${clientIp(req, server)}`, { max: 20, windowMs: 15 * 60_000 });
    rateLimit(`login-phone:${phone}`, { max: 8, windowMs: 15 * 60_000 });

    const [user] = await sql`SELECT * FROM users WHERE phone = ${phone}`;
    const ok = await verifyPassword(password, user?.password_hash || DUMMY_HASH);
    if (!user || !ok) throw unauthorized("Wrong phone number or password");
    if (!user.active) throw new HttpError(403, "This account has been disabled. Contact the store.");

    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;
    return { user: publicUser(user), token: issueToken(user) };
  });

  r.get("/api/auth/me", async ({ req }) => {
    const user = await requireUser(req);
    return { user: publicUser(user) };
  });

  r.patch("/api/me", async ({ req, body }) => {
    const user = await requireUser(req);
    const v = fields(body);
    const fullName = v.has("fullName") ? v.str("fullName", { label: "Full name", min: 2, max: 100 }) : user.full_name;
    const email = v.has("email") ? v.email("email") : user.email;
    v.done();
    const [u] = await sql`
      UPDATE users SET full_name = ${fullName}, email = ${email}, updated_at = now() WHERE id = ${user.id}
      RETURNING id, full_name, phone, email, role, active, created_at`;
    return { user: publicUser(u) };
  });

  r.post("/api/me/password", async ({ req, body }) => {
    const user = await requireUser(req);
    rateLimit(`pw:${user.id}`, { max: 5, windowMs: 15 * 60_000 });
    const v = fields(body);
    const current = v.str("currentPassword", { label: "Current password", trim: false, max: 200 });
    const next = v.password("newPassword", { label: "New password" });
    v.done();
    const [row] = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
    if (!(await verifyPassword(current, row.password_hash))) throw new HttpError(400, "Current password is wrong");
    await sql`UPDATE users SET password_hash = ${await hashPassword(next)}, updated_at = now() WHERE id = ${user.id}`;
    return { ok: true };
  });

  r.get("/api/me/orders", async ({ req, url }) => {
    const user = await requireUser(req);
    return listOrders(url.searchParams, { userId: user.id });
  });

  r.get("/api/me/orders/:number", async ({ req, params }) => {
    const user = await requireUser(req);
    const order = await loadOrder({ number: params.number.toUpperCase() });
    if (!order || order.userId !== user.id) throw notFound("Order not found");
    return { order };
  });
}
