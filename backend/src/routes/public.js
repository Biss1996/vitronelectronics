import { sql, pingDb } from "../db.js";
import { getUser } from "../auth.js";
import { notFound, badRequest, clientIp } from "../http.js";
import { rateLimit } from "../ratelimit.js";
import { getSettings } from "../settings.js";
import { listProducts, getProductBy, serializeProduct, productSelect } from "../products.js";
import { placeOrder, loadOrder } from "../orders.js";
import { normalizePhone } from "../validate.js";
import { serveLocalUpload, storageMode } from "../storage.js";

const startedAt = Date.now();

export function publicRoutes(r) {
  r.get("/api/health", async () => {
    let db = "ok";
    try { await pingDb(); } catch { db = "down"; }
    const body = { status: db === "ok" ? "ok" : "degraded", db, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), storage: storageMode };
    return new Response(JSON.stringify(body), {
      status: db === "ok" ? 200 : 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  });

  r.get("/api/settings", async () => {
    const s = await getSettings();
    return { settings: s };
  });

  r.get("/api/categories", async () => {
    const rows = await sql`
      SELECT c.id, c.name, c.slug, c.image_url, c.sort_order,
             (SELECT count(*)::int FROM products p WHERE p.category_id = c.id AND p.active) AS product_count
      FROM categories c WHERE c.active
      ORDER BY c.sort_order, c.name`;
    return {
      categories: rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, image: c.image_url, productCount: c.product_count })),
    };
  });

  r.get("/api/brands", async () => {
    const rows = await sql`
      SELECT min(brand) AS brand, count(*)::int AS n FROM products
      WHERE active AND brand IS NOT NULL AND brand <> ''
      GROUP BY lower(brand) ORDER BY min(brand)`;
    return { brands: rows.map((b) => ({ name: b.brand, count: b.n })) };
  });

  r.get("/api/products", async ({ url }) => listProducts(url.searchParams));

  r.get("/api/products/:slug", async ({ params }) => {
    const product = await getProductBy({ slug: params.slug });
    if (!product) throw notFound("Product not found");
    const related = product.category
      ? await sql`${productSelect} WHERE p.active AND p.category_id = ${product.category.id} AND p.id <> ${product.id}
                  ORDER BY p.featured DESC, random() LIMIT 4`
      : [];
    return { product, related: related.map(serializeProduct) };
  });

  // Checkout — guests and signed-in customers.
  r.post("/api/orders", async ({ req, body, server }) => {
    rateLimit(`order:${clientIp(req, server)}`, { max: 10, windowMs: 10 * 60_000 });
    const user = await getUser(req);
    const result = await placeOrder(body, user);
    const order = await loadOrder({ id: result.orderId });
    return { order, user: result.user, token: result.token };
  });

  // Guest order tracking: order number + phone used at checkout.
  r.get("/api/orders/track", async ({ req, url, server }) => {
    rateLimit(`track:${clientIp(req, server)}`, { max: 30, windowMs: 10 * 60_000 });
    const number = (url.searchParams.get("number") || "").trim().toUpperCase();
    const phone = normalizePhone(url.searchParams.get("phone"));
    if (!number || !phone) throw badRequest("Enter your order number and the phone number you used");
    const order = await loadOrder({ number: number.startsWith("VTR-") ? number : `VTR-${number}` });
    if (!order || (order.customer.phone !== phone && order.customer.altPhone !== phone)) {
      throw notFound("We couldn't find an order with that number and phone");
    }
    return { order };
  });

  // Local image uploads (development only — production uses Spaces).
  r.get("/api/uploads/:a/:b/:file", async ({ params }) => {
    const res = await serveLocalUpload(`${params.a}/${params.b}/${params.file}`);
    if (!res) throw notFound();
    return res;
  });
}
