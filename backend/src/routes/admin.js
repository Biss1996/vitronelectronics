import { sql } from "../db.js";
import { requirePermission, hashPassword, publicUser } from "../auth.js";
import { badRequest, conflict, forbidden, notFound } from "../http.js";
import { fields, parseId, slugify } from "../validate.js";
import { getSettings, updateSettings } from "../settings.js";
import { listProducts, getProductBy, createProduct, updateProduct, updateStock } from "../products.js";
import { listOrders, loadOrder, updateOrder } from "../orders.js";
import { saveImage } from "../storage.js";
import { config } from "../config.js";
import { rateLimit } from "../ratelimit.js";
import { sourceOf, fetchPage, fetchImage, draftFromHtml, draftFromText, findExisting, isAllowedImageUrl } from "../importer.js";

export function adminRoutes(r) {
  /* ---------------- Dashboard ---------------- */
  r.get("/api/admin/stats", async ({ req }) => {
    await requirePermission(req, "dashboard:view");
    const [[totals], daily, lowStock, recent, top] = await Promise.all([
      sql`
        SELECT
          count(*) FILTER (WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Nairobi') AT TIME ZONE 'Africa/Nairobi')::int AS orders_today,
          COALESCE(sum(total) FILTER (WHERE status <> 'cancelled'
            AND created_at >= date_trunc('day', now() AT TIME ZONE 'Africa/Nairobi') AT TIME ZONE 'Africa/Nairobi'), 0)::float8 AS sales_today,
          COALESCE(sum(total) FILTER (WHERE status <> 'cancelled' AND created_at >= now() - interval '30 days'), 0)::float8 AS sales_30d,
          COALESCE(sum(total) FILTER (WHERE payment_status = 'paid' AND created_at >= now() - interval '30 days'), 0)::float8 AS collected_30d,
          count(*) FILTER (WHERE status = 'pending')::int AS pending,
          count(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
          count(*) FILTER (WHERE status = 'dispatched')::int AS dispatched,
          count(*) FILTER (WHERE status = 'delivered' AND payment_status = 'unpaid')::int AS delivered_unpaid
        FROM orders`,
      sql`
        SELECT to_char(d, 'YYYY-MM-DD') AS day,
               COALESCE(count(o.id), 0)::int AS orders,
               COALESCE(sum(o.total) FILTER (WHERE o.status <> 'cancelled'), 0)::float8 AS sales
        FROM generate_series((now() AT TIME ZONE 'Africa/Nairobi')::date - 13, (now() AT TIME ZONE 'Africa/Nairobi')::date, interval '1 day') d
        LEFT JOIN orders o ON (o.created_at AT TIME ZONE 'Africa/Nairobi')::date = d::date
        GROUP BY d ORDER BY d`,
      sql`
        SELECT * FROM (
          SELECT p.id, p.name, p.slug, p.images->>0 AS image,
                 CASE WHEN EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)
                      THEN (SELECT sum(stock) FROM product_variants v WHERE v.product_id = p.id)::int
                      ELSE p.stock END AS stock
          FROM products p WHERE p.active
        ) s WHERE stock <= 3 ORDER BY stock, name LIMIT 8`,
      sql`
        SELECT o.*, (SELECT COALESCE(SUM(quantity), 0)::int FROM order_items WHERE order_id = o.id) AS item_count
        FROM orders o ORDER BY o.created_at DESC LIMIT 6`,
      sql`
        SELECT oi.name, sum(oi.quantity)::int AS qty, sum(oi.line_total)::float8 AS sales
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.status <> 'cancelled' AND o.created_at >= now() - interval '30 days'
        GROUP BY oi.name ORDER BY qty DESC LIMIT 5`,
    ]);
    return {
      totals: {
        ordersToday: totals.orders_today,
        salesToday: totals.sales_today,
        sales30d: totals.sales_30d,
        collected30d: totals.collected_30d,
        pending: totals.pending,
        confirmed: totals.confirmed,
        dispatched: totals.dispatched,
        deliveredUnpaid: totals.delivered_unpaid,
      },
      daily,
      lowStock,
      recentOrders: recent.map((o) => ({
        id: o.id, orderNumber: o.order_number, customer: o.customer_name, total: o.total,
        status: o.status, paymentStatus: o.payment_status, itemCount: o.item_count, createdAt: o.created_at,
      })),
      topProducts: top,
    };
  });

  /* ---------------- Products ---------------- */
  r.get("/api/admin/products", async ({ req, url }) => {
    await requirePermission(req, "products:view");
    return listProducts(url.searchParams, { includeInactive: true });
  });

  r.get("/api/admin/products/:id", async ({ req, params }) => {
    await requirePermission(req, "products:view");
    const product = await getProductBy({ id: parseId(params.id) }, { includeInactive: true });
    if (!product) throw notFound("Product not found");
    const [src] = await sql`SELECT source, url, external_id, source_price, imported_at FROM product_sources WHERE product_id = ${product.id}`;
    return {
      product: {
        ...product,
        source: src ? { site: src.source, url: src.url, sku: src.external_id, price: src.source_price, importedAt: src.imported_at } : null,
      },
    };
  });

  /* ---------------- Import from Jumia / Kilimall ---------------- */
  // Preview: read a product page (or pasted page text) into a draft. Saves nothing.
  r.post("/api/admin/import/preview", async ({ req, body }) => {
    const actor = await requirePermission(req, "products:write");
    rateLimit(`import:${actor.id}`, { max: 60, windowMs: 10 * 60_000 });
    const src = body.url ? sourceOf(body.url) : null;
    if (body.url && !src) throw badRequest("Only jumia.co.ke and kilimall.co.ke links can be imported");
    let draft;
    if (typeof body.text === "string" && body.text.trim()) {
      const pasted = body.text.slice(0, 4_000_000);
      // Page source (Ctrl+U) keeps photos and specs; plain page text is the last resort.
      draft = /<(!doctype|html|head|meta|h1)\b/i.test(pasted)
        ? await draftFromHtml(pasted, { source: src?.source || "jumia" })
        : await draftFromText(pasted);
    } else {
      if (!src) throw badRequest("Paste a product link");
      draft = await draftFromHtml(await fetchPage(src.url), { source: src.source });
    }
    const existing = src ? await findExisting(src.url, src.source, draft.sku || null) : null;
    return { draft, source: src?.source || "manual", url: src?.url || null, existing };
  });

  // Save: copy the chosen images into our storage, create the product, remember the source.
  r.post("/api/admin/import/save", async ({ req, body }) => {
    const actor = await requirePermission(req, "products:write");
    const src = body.sourceUrl ? sourceOf(body.sourceUrl) : null;
    if (body.sourceUrl && !src) throw badRequest("Only jumia.co.ke and kilimall.co.ke links can be imported");
    const sku = body.sourceSku ? String(body.sourceSku).slice(0, 80) : null;
    if (src && !body.allowDuplicate) {
      const dup = await findExisting(src.url, src.source, sku);
      if (dup) throw conflict(`Already imported as "${dup.name}"`);
    }

    const own = (u) => u.startsWith("/api/uploads/") || (config.spaces.publicUrl && u.startsWith(config.spaces.publicUrl + "/"));
    // Copy images 4 at a time, keeping the admin's order.
    const wanted = (Array.isArray(body.images) ? body.images : []).slice(0, 20).map((u) => String(u || ""));
    const results = new Array(wanted.length).fill(null);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, wanted.length) }, async () => {
      while (next < wanted.length) {
        const i = next++;
        const url = wanted[i];
        if (own(url)) { results[i] = url; continue; }
        if (!isAllowedImageUrl(url)) continue;
        try { results[i] = (await saveImage(await fetchImage(url))).url; } catch { /* reported below */ }
      }
    }));
    const images = results.filter(Boolean);
    const imageErrors = wanted.filter((_, i) => !results[i]);

    const product = await createProduct({ ...body, images });
    if (src) {
      await sql`
        INSERT INTO product_sources (product_id, source, url, external_id, source_price, source_old_price, imported_by)
        VALUES (${product.id}, ${src.source}, ${src.url}, ${sku}, ${Number.isInteger(body.sourcePrice) ? body.sourcePrice : null},
                ${Number.isInteger(body.sourceOldPrice) ? body.sourceOldPrice : null}, ${actor.id})
        ON CONFLICT (url) DO NOTHING`;
    }
    return { product, imageErrors };
  });

  r.post("/api/admin/products", async ({ req, body }) => {
    await requirePermission(req, "products:write");
    return { product: await createProduct(body) };
  });

  r.put("/api/admin/products/:id", async ({ req, params, body }) => {
    await requirePermission(req, "products:write");
    return { product: await updateProduct(parseId(params.id), body) };
  });

  r.patch("/api/admin/products/:id/stock", async ({ req, params, body }) => {
    await requirePermission(req, "stock:update");
    return { product: await updateStock(parseId(params.id), body) };
  });

  r.delete("/api/admin/products/:id", async ({ req, params }) => {
    await requirePermission(req, "products:write");
    const id = parseId(params.id);
    const [used] = await sql`SELECT 1 FROM order_items WHERE product_id = ${id} LIMIT 1`;
    if (used) {
      // Keep products that appear in orders; hide them instead.
      await sql`UPDATE products SET active = false, updated_at = now() WHERE id = ${id}`;
      return { ok: true, archived: true, message: "This product has orders, so it was hidden instead of deleted." };
    }
    const res = await sql`DELETE FROM products WHERE id = ${id} RETURNING id`;
    if (!res.length) throw notFound("Product not found");
    return { ok: true, archived: false };
  });

  /* ---------------- Categories ---------------- */
  r.get("/api/admin/categories", async ({ req }) => {
    await requirePermission(req, "products:view");
    const rows = await sql`
      SELECT c.*, (SELECT count(*)::int FROM products p WHERE p.category_id = c.id) AS product_count
      FROM categories c ORDER BY c.sort_order, c.name`;
    return {
      categories: rows.map((c) => ({
        id: c.id, name: c.name, slug: c.slug, image: c.image_url, sortOrder: c.sort_order, active: c.active, productCount: c.product_count,
      })),
    };
  });

  const readCategory = (body) => {
    const v = fields(body);
    const name = v.str("name", { label: "Category name", min: 2, max: 60 });
    const slug = slugify(v.str("slug", { required: false, max: 60 }) || name || "");
    const image = v.str("image", { label: "Image URL", required: false, max: 500 });
    if (image && !/^(https?:\/\/|\/api\/uploads\/)/.test(image)) v.fail("image", "Image must be a link starting with https://");
    const sortOrder = v.int("sortOrder", { required: false, min: 0, max: 10000 }) ?? 0;
    const active = v.bool("active", true);
    v.done();
    return { name, slug, image, sortOrder, active };
  };

  r.post("/api/admin/categories", async ({ req, body }) => {
    await requirePermission(req, "categories:write");
    const c = readCategory(body);
    const [dupe] = await sql`SELECT 1 FROM categories WHERE slug = ${c.slug}`;
    if (dupe) throw conflict("A category with that name already exists");
    const [row] = await sql`
      INSERT INTO categories (name, slug, image_url, sort_order, active)
      VALUES (${c.name}, ${c.slug}, ${c.image}, ${c.sortOrder}, ${c.active}) RETURNING id`;
    return { id: row.id };
  });

  r.put("/api/admin/categories/:id", async ({ req, params, body }) => {
    await requirePermission(req, "categories:write");
    const id = parseId(params.id);
    const c = readCategory(body);
    const [dupe] = await sql`SELECT 1 FROM categories WHERE slug = ${c.slug} AND id <> ${id}`;
    if (dupe) throw conflict("A category with that name already exists");
    const res = await sql`
      UPDATE categories SET name = ${c.name}, slug = ${c.slug}, image_url = ${c.image}, sort_order = ${c.sortOrder}, active = ${c.active}
      WHERE id = ${id} RETURNING id`;
    if (!res.length) throw notFound("Category not found");
    return { ok: true };
  });

  r.delete("/api/admin/categories/:id", async ({ req, params }) => {
    await requirePermission(req, "categories:write");
    const id = parseId(params.id);
    const res = await sql`DELETE FROM categories WHERE id = ${id} RETURNING id`;
    if (!res.length) throw notFound("Category not found");
    return { ok: true };
  });

  /* ---------------- Uploads ---------------- */
  r.post("/api/admin/uploads", async ({ req }) => {
    await requirePermission(req, "uploads:write");
    let form;
    try { form = await req.formData(); } catch { throw badRequest("Send the image as multipart/form-data"); }
    const files = form.getAll("file");
    if (!files.length) throw badRequest("No image received");
    if (files.length > 10) throw badRequest("Upload at most 10 images at a time");
    const uploaded = [];
    for (const f of files) uploaded.push(await saveImage(f));
    return { files: uploaded };
  });

  /* ---------------- Orders ---------------- */
  r.get("/api/admin/orders", async ({ req, url }) => {
    await requirePermission(req, "orders:view");
    return listOrders(url.searchParams);
  });

  r.get("/api/admin/orders/:id", async ({ req, params }) => {
    await requirePermission(req, "orders:view");
    const order = await loadOrder({ id: parseId(params.id) });
    if (!order) throw notFound("Order not found");
    return { order };
  });

  r.patch("/api/admin/orders/:id", async ({ req, params, body }) => {
    const actor = await requirePermission(req, "orders:update");
    return { order: await updateOrder(parseId(params.id), body, actor) };
  });

  /* ---------------- Customers (registered + guest buyers) ---------------- */
  r.get("/api/admin/customers", async ({ req, url }) => {
    await requirePermission(req, "customers:view");
    const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const page = Math.max(Number(url.searchParams.get("page")) || 1, 1);
    const limit = 30;
    const like = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
    const digits = q.replace(/\D/g, "");
    const rows = await sql`
      WITH o AS (
        SELECT phone,
               (array_agg(customer_name ORDER BY created_at DESC))[1] AS name,
               (array_agg(email ORDER BY created_at DESC) FILTER (WHERE email IS NOT NULL))[1] AS email,
               count(*)::int AS orders,
               COALESCE(sum(total) FILTER (WHERE status <> 'cancelled'), 0)::float8 AS spent,
               max(created_at) AS last_order_at
        FROM orders GROUP BY phone
      ), u AS (SELECT * FROM users WHERE role = 'customer'),
      merged AS (
        SELECT COALESCE(u.phone, o.phone) AS phone,
               COALESCE(u.full_name, o.name) AS name,
               COALESCE(u.email, o.email) AS email,
               (u.id IS NOT NULL) AS has_account,
               COALESCE(o.orders, 0) AS orders,
               COALESCE(o.spent, 0) AS spent,
               o.last_order_at,
               u.created_at AS registered_at
        FROM u FULL OUTER JOIN o ON o.phone = u.phone
      )
      SELECT *, count(*) OVER ()::int AS total_rows FROM merged
      ${q ? sql`WHERE name ILIKE ${like} ${digits.length >= 4 ? sql`OR phone LIKE ${"%" + digits.slice(-9) + "%"}` : sql``}` : sql``}
      ORDER BY last_order_at DESC NULLS LAST, registered_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    const total = rows[0]?.total_rows || 0;
    return {
      items: rows.map(({ total_rows, ...c }) => ({
        phone: c.phone, name: c.name, email: c.email, hasAccount: c.has_account, orders: c.orders,
        spent: c.spent, lastOrderAt: c.last_order_at, registeredAt: c.registered_at,
      })),
      total, page, pages: Math.max(1, Math.ceil(total / limit)),
    };
  });

  /* ---------------- Team (staff & admin accounts) ---------------- */
  r.get("/api/admin/users", async ({ req, url }) => {
    await requirePermission(req, "users:manage");
    const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
    const like = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
    const digits = q.replace(/\D/g, "");
    const rows = q
      ? await sql`SELECT * FROM users WHERE full_name ILIKE ${like}
                  ${digits.length >= 4 ? sql`OR phone LIKE ${"%" + digits.slice(-9) + "%"}` : sql``}
                  ORDER BY role DESC, full_name LIMIT 30`
      : await sql`SELECT * FROM users WHERE role IN ('staff', 'admin') ORDER BY role, full_name`;
    return {
      users: rows.map((u) => ({ ...publicUser(u), active: u.active, lastLoginAt: u.last_login_at })),
    };
  });

  r.post("/api/admin/users", async ({ req, body }) => {
    await requirePermission(req, "users:manage");
    const v = fields(body);
    const fullName = v.str("fullName", { label: "Full name", min: 2, max: 100 });
    const phone = v.phone("phone");
    const email = v.email("email");
    const password = v.password("password");
    const role = v.oneOf("role", ["staff", "admin"], { label: "Role" });
    v.done();
    const [exists] = await sql`SELECT id FROM users WHERE phone = ${phone}`;
    if (exists) throw conflict("That phone number already has an account — search for it below and change its role instead.");
    const [u] = await sql`
      INSERT INTO users (full_name, phone, email, password_hash, role)
      VALUES (${fullName}, ${phone}, ${email}, ${await hashPassword(password)}, ${role})
      RETURNING *`;
    return { user: publicUser(u) };
  });

  r.patch("/api/admin/users/:id", async ({ req, params, body }) => {
    const actor = await requirePermission(req, "users:manage");
    const id = parseId(params.id);
    const role = body.role;
    const active = body.active;
    const password = body.password;
    if (role !== undefined && !["customer", "staff", "admin"].includes(role)) throw badRequest("Unknown role");
    if (active !== undefined && typeof active !== "boolean") throw badRequest("active must be true or false");
    if (password !== undefined && (typeof password !== "string" || password.length < 6)) throw badRequest("Password must be at least 6 characters");

    if (id === actor.id && ((role && role !== actor.role) || active === false)) {
      throw forbidden("You can't change your own role or disable your own account");
    }

    const u = await sql.begin(async (tx) => {
      // Serialize admin changes so two admins can't demote each other at the same moment.
      await tx`SELECT pg_advisory_xact_lock(424242)`;
      const [target] = await tx`SELECT * FROM users WHERE id = ${id} FOR UPDATE`;
      if (!target) throw notFound("User not found");

      const losingAdmin = target.role === "admin" && target.active && ((role && role !== "admin") || active === false);
      if (losingAdmin) {
        const [{ n }] = await tx`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND active AND id <> ${id}`;
        if (n === 0) throw forbidden("You can't remove the last admin");
      }

      const [updated] = await tx`
        UPDATE users SET
          role = ${role ?? target.role},
          active = ${active ?? target.active},
          password_hash = ${password ? await hashPassword(password) : target.password_hash},
          updated_at = now()
        WHERE id = ${id} RETURNING *`;
      return updated;
    });
    return { user: { ...publicUser(u), active: u.active, lastLoginAt: u.last_login_at } };
  });

  /* ---------------- Settings ---------------- */
  r.get("/api/admin/settings", async ({ req }) => {
    await requirePermission(req, "dashboard:view");
    return { settings: await getSettings() };
  });

  r.put("/api/admin/settings", async ({ req, body }) => {
    await requirePermission(req, "settings:write");
    return { settings: await updateSettings(body) };
  });
}

