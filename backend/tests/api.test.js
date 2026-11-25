// End-to-end API tests. Run against a server with a seeded database and an admin:
//   bun run seed && bun run create-admin 0711111111 'admin-pass-1' "Test Admin"
//   bun run dev            (in another terminal)
//   TEST_ADMIN_PHONE=0711111111 TEST_ADMIN_PASSWORD=admin-pass-1 bun test
// The tests create their own products, orders and users, so they're safe to re-run,
// but don't point them at your live database.
import { describe, test, expect, beforeAll } from "bun:test";

const BASE = process.env.API_URL || "http://localhost:4000";
const ADMIN = { phone: process.env.TEST_ADMIN_PHONE || "0711111111", password: process.env.TEST_ADMIN_PASSWORD || "admin-pass-1" };

const rand = () => Math.floor(Math.random() * 1e8).toString().padStart(8, "0");
const randomPhone = () => `07${rand()}`;

async function api(path, { method = "GET", body, token, form } = {}) {
  const headers = { "do-connecting-ip": `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` };
  if (token) headers.authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["content-type"] = "application/json"; payload = JSON.stringify(body); }
  const res = await fetch(BASE + path, { method, headers, body: payload });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const login = async (phone, password) => (await api("/api/auth/login", { method: "POST", body: { phone, password } })).data;

let adminToken;
let zoneId;
let simpleProduct;   // no variants, stock 5
let variantProduct;  // two variants

const checkout = (items, extra = {}) =>
  api("/api/orders", {
    method: "POST",
    token: extra.token,
    body: {
      fullName: "Wanjiru Test", phone: extra.phone || randomPhone(), zoneId, town: "Westlands",
      address: "ABC Place, 2nd floor", items, ...extra.body,
    },
  });

beforeAll(async () => {
  const a = await login(ADMIN.phone, ADMIN.password);
  if (!a?.token) throw new Error("Admin login failed — create the test admin first (see top of file)");
  adminToken = a.token;

  const s = await api("/api/settings");
  zoneId = s.data.settings.deliveryZones[0].id;

  const cats = await api("/api/categories");
  const categoryId = cats.data.categories[0].id;

  simpleProduct = (await api("/api/admin/products", {
    method: "POST", token: adminToken,
    body: { name: `Test Charger ${rand()}`, brand: "TestCo", price: 1000, stock: 5, categoryId, images: ["https://example.com/a.jpg"], specs: [{ label: "Output", value: "25W" }] },
  })).data.product;

  variantProduct = (await api("/api/admin/products", {
    method: "POST", token: adminToken,
    body: {
      name: `Test Phone ${rand()}`, brand: "TestCo", price: 0, categoryId,
      variants: [{ label: "128GB", price: 20000, stock: 2 }, { label: "256GB", price: 25000, stock: 1 }],
    },
  })).data.product;
});

describe("health & catalogue", () => {
  test("health check reports the database", async () => {
    const r = await api("/api/health");
    expect(r.status).toBe(200);
    expect(r.data.db).toBe("ok");
  });

  test("products are searchable and paginated", async () => {
    const r = await api(`/api/products?q=${encodeURIComponent(simpleProduct.name)}`);
    expect(r.status).toBe(200);
    expect(r.data.items[0].id).toBe(simpleProduct.id);
    expect(r.data.total).toBe(1);
  });

  test("variant product reports cheapest price and summed stock", () => {
    expect(variantProduct.price).toBe(20000);
    expect(variantProduct.stock).toBe(3);
    expect(variantProduct.variants).toHaveLength(2);
  });

  test("hidden products are not public", async () => {
    const p = (await api("/api/admin/products", { method: "POST", token: adminToken, body: { name: `Draft ${rand()}`, price: 10, stock: 1, active: false } })).data.product;
    expect((await api(`/api/products/${p.slug}`)).status).toBe(404);
    expect((await api(`/api/admin/products/${p.id}`, { token: adminToken })).status).toBe(200);
  });
});

describe("checkout (pay on delivery)", () => {
  test("guest order: server prices ignore browser prices, stock is reserved", async () => {
    const r = await checkout([{ productId: simpleProduct.id, quantity: 2, price: 1 }], { body: { total: 5 } });
    expect(r.status).toBe(200);
    const o = r.data.order;
    expect(o.orderNumber).toMatch(/^VTR-[A-Z2-9]{6}$/);
    expect(o.subtotal).toBe(2000);
    expect(o.total).toBe(2000 + o.deliveryFee);
    expect(o.status).toBe("pending");
    expect(o.paymentMethod).toBe("cash_on_delivery");
    expect(o.paymentStatus).toBe("unpaid");
    expect(o.customer.phone).toMatch(/^\+2547\d{8}$/);
    const p = (await api(`/api/products/${simpleProduct.slug}`)).data.product;
    expect(p.stock).toBe(3);
  });

  test("ordering more than in stock fails and changes nothing", async () => {
    const r = await checkout([{ productId: variantProduct.id, variantId: variantProduct.variants[0].id, quantity: 1 }, { productId: simpleProduct.id, quantity: 99 }]);
    expect(r.status).toBe(400); // quantity > 20 rejected by validation
    const r2 = await checkout([{ productId: variantProduct.id, variantId: variantProduct.variants[0].id, quantity: 1 }, { productId: simpleProduct.id, quantity: 10 }]);
    expect(r2.status).toBe(409);
    expect(r2.data.error).toContain("left");
    const p = (await api(`/api/products/${variantProduct.slug}`)).data.product;
    expect(p.variants[0].stock).toBe(2); // rolled back
  });

  test("a variant product needs a variant", async () => {
    const r = await checkout([{ productId: variantProduct.id, quantity: 1 }]);
    expect(r.status).toBe(409);
    expect(r.data.error).toContain("choose an option");
  });

  test("variant order uses the variant price", async () => {
    const r = await checkout([{ productId: variantProduct.id, variantId: variantProduct.variants[1].id, quantity: 1 }]);
    expect(r.status).toBe(200);
    expect(r.data.order.subtotal).toBe(25000);
    expect(r.data.order.items[0].variantLabel).toBe("256GB");
  });

  test("validation explains every missing field", async () => {
    const r = await api("/api/orders", { method: "POST", body: { items: [] } });
    expect(r.status).toBe(400);
    expect(Object.keys(r.data.details)).toEqual(expect.arrayContaining(["fullName", "phone", "zoneId", "town", "address", "items"]));
  });

  test("bad phone number is rejected", async () => {
    const r = await checkout([{ productId: simpleProduct.id, quantity: 1 }], { phone: "12345" });
    expect(r.status).toBe(400);
    expect(r.data.details.phone).toBeTruthy();
  });

  test("track order with order number + phone in any format", async () => {
    const phone = randomPhone();
    const o = (await checkout([{ productId: simpleProduct.id, quantity: 1 }], { phone })).data.order;
    const ok = await api(`/api/orders/track?number=${o.orderNumber.toLowerCase()}&phone=${encodeURIComponent("+254" + phone.slice(1))}`);
    expect(ok.status).toBe(200);
    expect(ok.data.order.id).toBe(o.id);
    const bad = await api(`/api/orders/track?number=${o.orderNumber}&phone=0700000001`);
    expect(bad.status).toBe(404);
  });
});

describe("accounts", () => {
  test("create an account during checkout, then see the order", async () => {
    const phone = randomPhone();
    const r = await checkout([{ productId: simpleProduct.id, quantity: 1 }], { phone, body: { createAccount: true, password: "secret123" } });
    expect(r.status).toBe(200);
    expect(r.data.token).toBeTruthy();
    expect(r.data.user.role).toBe("customer");
    const mine = await api("/api/me/orders", { token: r.data.token });
    expect(mine.data.items.map((o) => o.id)).toContain(r.data.order.id);

    const again = await checkout([{ productId: simpleProduct.id, quantity: 1 }], { phone, body: { createAccount: true, password: "secret123" } });
    expect(again.status).toBe(409);
  });

  test("registering later claims earlier guest orders", async () => {
    await api(`/api/admin/products/${simpleProduct.id}/stock`, { method: "PATCH", token: adminToken, body: { stock: 50 } });
    const phone = randomPhone();
    const o = (await checkout([{ productId: simpleProduct.id, quantity: 1 }], { phone })).data.order;
    const reg = await api("/api/auth/register", { method: "POST", body: { fullName: "Later Signup", phone, password: "secret123" } });
    expect(reg.status).toBe(200);
    const mine = await api("/api/me/orders", { token: reg.data.token });
    expect(mine.data.items.map((x) => x.id)).toContain(o.id);
  });

  test("wrong password is rejected", async () => {
    const r = await api("/api/auth/login", { method: "POST", body: { phone: ADMIN.phone, password: "nope-nope" } });
    expect(r.status).toBe(401);
  });

  test("customers can't see other people's orders", async () => {
    const a = (await api("/api/auth/register", { method: "POST", body: { fullName: "Cust A", phone: randomPhone(), password: "secret123" } })).data;
    const otherOrder = (await checkout([{ productId: simpleProduct.id, quantity: 1 }])).data.order;
    const r = await api(`/api/me/orders/${otherOrder.orderNumber}`, { token: a.token });
    expect(r.status).toBe(404);
  });
});

describe("roles & permissions", () => {
  let customer, staff, staffUserId;

  beforeAll(async () => {
    customer = (await api("/api/auth/register", { method: "POST", body: { fullName: "Plain Customer", phone: randomPhone(), password: "secret123" } })).data;
    const staffPhone = randomPhone();
    const created = await api("/api/admin/users", { method: "POST", token: adminToken, body: { fullName: "Shop Staff", phone: staffPhone, password: "staff-pass", role: "staff" } });
    expect(created.status).toBe(200);
    staffUserId = created.data.user.id;
    staff = await login(staffPhone, "staff-pass");
  });

  test("no token → 401, customer → 403 on admin routes", async () => {
    expect((await api("/api/admin/orders")).status).toBe(401);
    expect((await api("/api/admin/orders", { token: customer.token })).status).toBe(403);
    expect((await api("/api/admin/stats", { token: customer.token })).status).toBe(403);
  });

  test("staff can run orders, stock and customers", async () => {
    expect(staff.user.role).toBe("staff");
    expect(staff.user.permissions).toContain("orders:update");
    expect(staff.user.permissions).not.toContain("products:write");
    expect((await api("/api/admin/stats", { token: staff.token })).status).toBe(200);
    expect((await api("/api/admin/orders", { token: staff.token })).status).toBe(200);
    expect((await api("/api/admin/customers", { token: staff.token })).status).toBe(200);
    expect((await api(`/api/admin/products/${simpleProduct.id}/stock`, { method: "PATCH", token: staff.token, body: { stock: 40 } })).status).toBe(200);
    const o = (await checkout([{ productId: simpleProduct.id, quantity: 1 }])).data.order;
    const upd = await api(`/api/admin/orders/${o.id}`, { method: "PATCH", token: staff.token, body: { status: "confirmed", note: "Called customer" } });
    expect(upd.status).toBe(200);
    expect(upd.data.order.history.at(-1).by).toBe("Shop Staff");
  });

  test("staff cannot edit products, settings or team", async () => {
    expect((await api("/api/admin/products", { method: "POST", token: staff.token, body: { name: "X", price: 1 } })).status).toBe(403);
    expect((await api(`/api/admin/products/${simpleProduct.id}`, { method: "DELETE", token: staff.token })).status).toBe(403);
    expect((await api("/api/admin/categories", { method: "POST", token: staff.token, body: { name: "Hack" } })).status).toBe(403);
    expect((await api("/api/admin/settings", { method: "PUT", token: staff.token, body: { storeName: "Hacked" } })).status).toBe(403);
    expect((await api("/api/admin/users", { token: staff.token })).status).toBe(403);
    expect((await api(`/api/admin/users/${staffUserId}`, { method: "PATCH", token: staff.token, body: { role: "admin" } })).status).toBe(403);
  });

  test("admin cannot demote or disable themselves", async () => {
    const me = (await api("/api/auth/me", { token: adminToken })).data.user;
    expect((await api(`/api/admin/users/${me.id}`, { method: "PATCH", token: adminToken, body: { role: "staff" } })).status).toBe(403);
    expect((await api(`/api/admin/users/${me.id}`, { method: "PATCH", token: adminToken, body: { active: false } })).status).toBe(403);
  });

  test("disabling a staff account locks them out immediately", async () => {
    expect((await api(`/api/admin/users/${staffUserId}`, { method: "PATCH", token: adminToken, body: { active: false } })).status).toBe(200);
    expect((await api("/api/admin/orders", { token: staff.token })).status).toBe(401);
    await api(`/api/admin/users/${staffUserId}`, { method: "PATCH", token: adminToken, body: { active: true } });
    expect((await api("/api/admin/orders", { token: staff.token })).status).toBe(200);
  });

  test("promoting a customer to staff works without a new login", async () => {
    expect((await api(`/api/admin/users/${customer.user.id}`, { method: "PATCH", token: adminToken, body: { role: "staff" } })).status).toBe(200);
    expect((await api("/api/admin/orders", { token: customer.token })).status).toBe(200);
    await api(`/api/admin/users/${customer.user.id}`, { method: "PATCH", token: adminToken, body: { role: "customer" } });
    expect((await api("/api/admin/orders", { token: customer.token })).status).toBe(403);
  });

  test("forged tokens are rejected", async () => {
    const [h, p] = adminToken.split(".");
    expect((await api("/api/admin/orders", { token: `${h}.${p}.forged` })).status).toBe(401);
  });
});

describe("order lifecycle", () => {
  test("cancel returns stock; final states can't change", async () => {
    const before = (await api(`/api/products/${simpleProduct.slug}`)).data.product.stock;
    const o = (await checkout([{ productId: simpleProduct.id, quantity: 3 }])).data.order;
    expect((await api(`/api/products/${simpleProduct.slug}`)).data.product.stock).toBe(before - 3);
    const c = await api(`/api/admin/orders/${o.id}`, { method: "PATCH", token: adminToken, body: { status: "cancelled" } });
    expect(c.status).toBe(200);
    expect((await api(`/api/products/${simpleProduct.slug}`)).data.product.stock).toBe(before);
    expect((await api(`/api/admin/orders/${o.id}`, { method: "PATCH", token: adminToken, body: { status: "pending" } })).status).toBe(400);
    expect((await api(`/api/admin/orders/${o.id}`, { method: "PATCH", token: adminToken, body: { paymentStatus: "paid" } })).status).toBe(400);
  });

  test("deliver and mark paid", async () => {
    const o = (await checkout([{ productId: simpleProduct.id, quantity: 1 }])).data.order;
    for (const status of ["confirmed", "dispatched", "delivered"]) {
      expect((await api(`/api/admin/orders/${o.id}`, { method: "PATCH", token: adminToken, body: { status } })).status).toBe(200);
    }
    const paid = await api(`/api/admin/orders/${o.id}`, { method: "PATCH", token: adminToken, body: { paymentStatus: "paid" } });
    expect(paid.data.order.paymentStatus).toBe("paid");
    expect(paid.data.order.history.map((h) => h.status)).toEqual(["pending", "confirmed", "dispatched", "delivered", "delivered"]);
  });

  test("admin order list filters by status and searches", async () => {
    const o = (await checkout([{ productId: simpleProduct.id, quantity: 1 }])).data.order;
    const r = await api(`/api/admin/orders?status=pending&q=${o.orderNumber}`, { token: adminToken });
    expect(r.data.items.map((x) => x.id)).toEqual([o.id]);
    expect(r.data.counts.pending).toBeGreaterThan(0);
  });
});

describe("admin catalogue & settings", () => {
  test("update a product's variants", async () => {
    const p = (await api(`/api/admin/products/${variantProduct.id}`, { token: adminToken })).data.product;
    const r = await api(`/api/admin/products/${p.id}`, {
      method: "PUT", token: adminToken,
      body: { ...p, categoryId: p.category?.id, variants: [{ ...p.variants[0], stock: 9 }, { label: "512GB", price: 31000, stock: 1 }] },
    });
    expect(r.status).toBe(200);
    expect(r.data.product.variants.map((v) => v.label)).toEqual(["128GB", "512GB"]);
    expect(r.data.product.variants[0].id).toBe(p.variants[0].id);
    expect(r.data.product.stock).toBe(10);
  });

  test("deleting a product that has orders hides it instead", async () => {
    const r = await api(`/api/admin/products/${simpleProduct.id}`, { method: "DELETE", token: adminToken });
    expect(r.data.archived).toBe(true);
    expect((await api(`/api/products/${simpleProduct.slug}`)).status).toBe(404);
  });

  test("delivery settings drive the fee, including free delivery", async () => {
    const original = (await api("/api/admin/settings", { token: adminToken })).data.settings;
    const s = await api("/api/admin/settings", {
      method: "PUT", token: adminToken,
      body: { deliveryFeesEnabled: true, deliveryZones: [{ id: "nbi", name: "Nairobi", fee: 250 }], freeDeliveryOver: 30000, whatsappNumber: "0722000000" },
    });
    expect(s.status).toBe(200);
    expect(s.data.settings.whatsappNumber).toBe("254722000000");
    zoneId = "nbi";
    const small = await checkout([{ productId: variantProduct.id, variantId: variantProduct.variants[0].id, quantity: 1 }]);
    expect(small.data.order.deliveryFee).toBe(250);
    const big = await checkout([{ productId: variantProduct.id, variantId: variantProduct.variants[0].id, quantity: 2 }]);
    expect(big.data.order.deliveryFee).toBe(0);
    expect(big.data.order.deliveryFeePending).toBe(false);

    // Frozen: delivery is free on every order.
    await api("/api/admin/settings", { method: "PUT", token: adminToken, body: { deliveryFeesEnabled: false } });
    const frozen = await checkout([{ productId: variantProduct.id, variantId: variantProduct.variants[0].id, quantity: 1 }]);
    expect(frozen.data.order.deliveryFee).toBe(0);
    expect(frozen.data.order.deliveryFeePending).toBe(false);
    expect(frozen.data.order.total).toBe(frozen.data.order.subtotal);
    await api("/api/admin/settings", { method: "PUT", token: adminToken, body: original });
    zoneId = original.deliveryZones[0].id;
  });

  test("image upload (admin only)", async () => {
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("file", new File([png], "dot.png", { type: "image/png" }));
    const r = await api("/api/admin/uploads", { method: "POST", token: adminToken, form });
    expect(r.status).toBe(200);
    const url = r.data.files[0].url;
    if (url.startsWith("/api/uploads/")) {
      const img = await fetch(BASE + url);
      expect(img.status).toBe(200);
    }
    const bad = new FormData();
    bad.append("file", new File(["hello"], "x.txt", { type: "text/plain" }));
    expect((await api("/api/admin/uploads", { method: "POST", token: adminToken, form: bad })).status).toBe(400);
  });

  test("dashboard stats", async () => {
    const r = await api("/api/admin/stats", { token: adminToken });
    expect(r.status).toBe(200);
    expect(r.data.daily).toHaveLength(14);
    expect(r.data.totals.ordersToday).toBeGreaterThan(0);
  });
});
