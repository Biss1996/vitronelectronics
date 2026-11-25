import { sql } from "./db.js";
import { HttpError, badRequest, conflict, notFound } from "./http.js";
import { fields } from "./validate.js";
import { getSettings, deliveryFee } from "./settings.js";
import { hashPassword, issueToken, publicUser } from "./auth.js";

export const STATUSES = ["pending", "confirmed", "dispatched", "delivered", "cancelled"];

// Which status can follow which. Delivered and cancelled are final.
const TRANSITIONS = {
  pending: ["confirmed", "dispatched", "delivered", "cancelled"],
  confirmed: ["dispatched", "delivered", "cancelled"],
  dispatched: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
function newOrderNumber() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return "VTR-" + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function serializeOrder(o, items = [], history = []) {
  return {
    id: o.id,
    orderNumber: o.order_number,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    userId: o.user_id,
    customer: { fullName: o.customer_name, phone: o.phone, altPhone: o.alt_phone, email: o.email },
    delivery: { zone: o.delivery_zone, town: o.town, address: o.address, notes: o.notes },
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    deliveryFeePending: Boolean(o.delivery_fee_pending),
    total: o.total,
    itemCount: o.item_count ?? items.reduce((s, i) => s + i.quantity, 0),
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      variantId: i.variant_id,
      name: i.name,
      variantLabel: i.variant_label,
      image: i.image_url,
      unitPrice: i.unit_price,
      quantity: i.quantity,
      lineTotal: i.line_total,
      productSlug: i.product_slug ?? null,
    })),
    history: history.map((h) => ({ status: h.status, note: h.note, by: h.changed_by_name || null, at: h.created_at })),
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

export async function loadOrder(where) {
  const [o] = where.id
    ? await sql`SELECT * FROM orders WHERE id = ${where.id}`
    : await sql`SELECT * FROM orders WHERE order_number = ${where.number}`;
  if (!o) return null;
  const [items, history] = await Promise.all([
    sql`SELECT oi.*, p.slug AS product_slug FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ${o.id} ORDER BY oi.id`,
    sql`SELECT h.*, u.full_name AS changed_by_name FROM order_status_history h LEFT JOIN users u ON u.id = h.changed_by
        WHERE h.order_id = ${o.id} ORDER BY h.created_at, h.id`,
  ]);
  return serializeOrder(o, items, history);
}

/**
 * Place an order. Prices, stock and delivery fee are computed here from the database —
 * whatever the browser sends for prices is ignored.
 */
export async function placeOrder(body, currentUser) {
  const v = fields(body);
  const fullName = v.str("fullName", { label: "Full name", min: 2, max: 100 });
  const phone = v.phone("phone");
  const altPhone = v.phone("altPhone", { label: "Alternative phone", required: false });
  const email = v.email("email");
  const zoneId = v.str("zoneId", { label: "Delivery area", max: 60 });
  const town = v.str("town", { label: "Town / area", min: 2, max: 100 });
  const address = v.str("address", { label: "Delivery address", min: 3, max: 300 });
  const notes = v.str("notes", { label: "Notes", required: false, max: 500 });
  const createAccount = !currentUser && v.bool("createAccount");
  const password = createAccount ? v.password("password") : null;

  // Items: merge duplicates, cap quantities.
  const raw = Array.isArray(body.items) ? body.items : [];
  if (raw.length === 0) v.fail("items", "Your cart is empty");
  if (raw.length > 50) v.fail("items", "Too many different items in one order");
  const merged = new Map();
  for (const it of raw) {
    const productId = Number(it?.productId);
    const variantId = it?.variantId == null || it?.variantId === "" ? null : Number(it.variantId);
    const quantity = Number(it?.quantity);
    if (!Number.isInteger(productId) || productId <= 0 || (variantId !== null && (!Number.isInteger(variantId) || variantId <= 0))) {
      v.fail("items", "Cart contains an invalid item — please refresh your cart");
      continue;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      v.fail("items", "Quantity per item must be between 1 and 20");
      continue;
    }
    const key = `${productId}:${variantId ?? ""}`;
    const prev = merged.get(key);
    merged.set(key, { productId, variantId, quantity: Math.min(20, (prev?.quantity || 0) + quantity) });
  }
  v.done();

  const settings = await getSettings();

  return sql.begin(async (tx) => {
    // 1. Optionally create the customer's account.
    let userId = currentUser?.id ?? null;
    let newUser = null;
    if (createAccount) {
      const [exists] = await tx`SELECT id FROM users WHERE phone = ${phone}`;
      if (exists) {
        throw conflict("This phone number already has an account. Sign in first, or untick “Create an account”.");
      }
      const hash = await hashPassword(password);
      [newUser] = await tx`
        INSERT INTO users (full_name, phone, email, password_hash)
        VALUES (${fullName}, ${phone}, ${email}, ${hash})
        RETURNING id, full_name, phone, email, role, active, created_at`;
      userId = newUser.id;
      await tx`UPDATE orders SET user_id = ${userId} WHERE phone = ${phone} AND user_id IS NULL`;
    }

    // 2. Reserve stock and price every line from the database.
    const lines = [];
    const problems = [];
    for (const it of merged.values()) {
      if (it.variantId) {
        const [row] = await tx`
          UPDATE product_variants v SET stock = v.stock - ${it.quantity}
          FROM products p
          WHERE v.id = ${it.variantId} AND v.product_id = ${it.productId} AND p.id = v.product_id
            AND p.active AND v.stock >= ${it.quantity}
          RETURNING v.price, v.label, p.name, p.images->>0 AS image`;
        if (row) {
          lines.push({ ...it, name: row.name, variantLabel: row.label, image: row.image, unitPrice: row.price });
          continue;
        }
        const [info] = await tx`
          SELECT p.name, p.active, v.label, v.stock FROM product_variants v JOIN products p ON p.id = v.product_id
          WHERE v.id = ${it.variantId} AND v.product_id = ${it.productId}`;
        problems.push(!info || !info.active
          ? "An item in your cart is no longer available"
          : info.stock === 0
            ? `${info.name} (${info.label}) is out of stock`
            : `Only ${info.stock} of ${info.name} (${info.label}) left`);
      } else {
        const [row] = await tx`
          UPDATE products p SET stock = p.stock - ${it.quantity}
          WHERE p.id = ${it.productId} AND p.active AND p.stock >= ${it.quantity}
            AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)
          RETURNING p.price, p.name, p.images->>0 AS image`;
        if (row) {
          lines.push({ ...it, name: row.name, variantLabel: null, image: row.image, unitPrice: row.price });
          continue;
        }
        const [info] = await tx`
          SELECT p.name, p.active, p.stock,
                 EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id) AS has_variants
          FROM products p WHERE p.id = ${it.productId}`;
        problems.push(!info || !info.active
          ? "An item in your cart is no longer available"
          : info.has_variants
            ? `Please choose an option for ${info.name}`
            : info.stock === 0
              ? `${info.name} is out of stock`
              : `Only ${info.stock} of ${info.name} left`);
      }
    }
    if (problems.length) {
      throw new HttpError(409, problems[0], { items: problems });
    }

    // 3. Totals.
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const delivery = deliveryFee(settings, zoneId, subtotal);
    if (!delivery) throw badRequest("Please choose a delivery area", { zoneId: "Please choose a delivery area" });
    const total = subtotal + delivery.fee;

    // 4. Save the order.
    let order;
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      const number = newOrderNumber();
      const [taken] = await tx`SELECT 1 FROM orders WHERE order_number = ${number}`;
      if (taken) continue;
      [order] = await tx`
        INSERT INTO orders (order_number, user_id, customer_name, phone, alt_phone, email, delivery_zone, town,
                            address, notes, subtotal, delivery_fee, delivery_fee_pending, total)
        VALUES (${number}, ${userId}, ${fullName}, ${phone}, ${altPhone}, ${email}, ${delivery.zone.name}, ${town},
                ${address}, ${notes}, ${subtotal}, ${delivery.fee}, ${delivery.pending}, ${total})
        RETURNING *`;
    }
    if (!order) throw new Error("Could not generate an order number");

    for (const l of lines) {
      await tx`
        INSERT INTO order_items (order_id, product_id, variant_id, name, variant_label, image_url, unit_price, quantity, line_total)
        VALUES (${order.id}, ${l.productId}, ${l.variantId}, ${l.name}, ${l.variantLabel}, ${l.image}, ${l.unitPrice},
                ${l.quantity}, ${l.unitPrice * l.quantity})`;
    }
    await tx`INSERT INTO order_status_history (order_id, status, note) VALUES (${order.id}, 'pending', 'Order placed')`;

    return {
      orderId: order.id,
      orderNumber: order.order_number,
      ...(newUser ? { user: publicUser(newUser), token: issueToken(newUser) } : {}),
    };
  });
}

/** Staff/admin: change status and/or payment status. Cancelling puts stock back. */
export async function updateOrder(id, body, actor) {
  const status = body.status ?? null;
  const paymentStatus = body.paymentStatus ?? null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
  if (status && !STATUSES.includes(status)) throw badRequest("Unknown status");
  if (paymentStatus && !["paid", "unpaid"].includes(paymentStatus)) throw badRequest("Unknown payment status");
  if (!status && !paymentStatus && !note) throw badRequest("Nothing to update");

  await sql.begin(async (tx) => {
    const [o] = await tx`SELECT * FROM orders WHERE id = ${id} FOR UPDATE`;
    if (!o) throw notFound("Order not found");

    if (status && status !== o.status) {
      if (!TRANSITIONS[o.status].includes(status)) {
        throw badRequest(`An order that is ${o.status} can't be changed to ${status}`);
      }
      if (status === "cancelled") {
        const items = await tx`SELECT product_id, variant_id, quantity FROM order_items WHERE order_id = ${id}`;
        for (const i of items) {
          if (i.variant_id) await tx`UPDATE product_variants SET stock = stock + ${i.quantity} WHERE id = ${i.variant_id}`;
          else if (i.product_id) await tx`UPDATE products SET stock = stock + ${i.quantity} WHERE id = ${i.product_id}`;
        }
      }
      await tx`UPDATE orders SET status = ${status}, updated_at = now() WHERE id = ${id}`;
      await tx`INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (${id}, ${status}, ${note}, ${actor.id})`;
    } else if (note && !paymentStatus) {
      await tx`INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES (${id}, ${o.status}, ${note}, ${actor.id})`;
    }

    if (paymentStatus && paymentStatus !== o.payment_status) {
      if (o.status === "cancelled" && paymentStatus === "paid") throw badRequest("A cancelled order can't be marked as paid");
      await tx`UPDATE orders SET payment_status = ${paymentStatus}, updated_at = now() WHERE id = ${id}`;
      await tx`INSERT INTO order_status_history (order_id, status, note, changed_by)
               VALUES (${id}, ${status || o.status}, ${paymentStatus === "paid" ? "Payment received" : "Marked as unpaid"}, ${actor.id})`;
    }
  });
  return loadOrder({ id });
}

export async function listOrders(params, { userId } = {}) {
  const status = params.get("status") || "";
  const q = (params.get("q") || "").trim().slice(0, 100);
  const limit = Math.min(Math.max(Number(params.get("limit")) || 25, 1), 100);
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const like = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;
  const digits = q.replace(/\D/g, "");

  const where = sql`
    WHERE TRUE
    ${userId ? sql`AND o.user_id = ${userId}` : sql``}
    ${STATUSES.includes(status) ? sql`AND o.status = ${status}` : sql``}
    ${q ? sql`AND (o.order_number ILIKE ${like} OR o.customer_name ILIKE ${like}
                   ${digits.length >= 4 ? sql`OR o.phone LIKE ${"%" + digits.slice(-9) + "%"}` : sql``})` : sql``}`;

  const [rows, [{ total }], counts] = await Promise.all([
    sql`SELECT o.*, (SELECT COALESCE(SUM(quantity), 0)::int FROM order_items WHERE order_id = o.id) AS item_count
        FROM orders o ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    sql`SELECT count(*)::int AS total FROM orders o ${where}`,
    userId ? Promise.resolve([]) : sql`SELECT status, count(*)::int AS n FROM orders GROUP BY status`,
  ]);

  return {
    items: rows.map((o) => serializeOrder(o)),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
  };
}
