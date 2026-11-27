// Importer tests. Parser tests run offline; API tests need the server running
// (same setup as api.test.js).
import { describe, test, expect, beforeAll } from "bun:test";
import { sourceOf, isAllowedImageUrl, warrantyFrom, draftFromHtml, draftFromText } from "../src/importer.js";

// A trimmed page shaped like a Jumia product page.
const JUMIA_HTML = `<!doctype html><html><head>
<title>Sonar 2L Cordless Electric Kettle | Jumia Kenya</title>
<meta property="og:title" content="Sonar 2L Cordless Electric Kettle, 1500W Energy Efficient, 1.5m Power Cord - Black (1YR WRTY) | Jumia Kenya">
<meta property="og:type" content="product">
<meta property="og:image" content="https://ke.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/25/0104492/1.jpg?0566">
</head><body>
<div class="brcbs col16 -pts -pbm"><a class="cbs" href="/">Home</a><a class="cbs" href="/home-office/">Home &amp; Office</a><a class="cbs" href="/small-appliances/">Small Appliances</a><a class="cbs" href="/electric-kettles/">Electric Kettles</a></div>
<div id="imgs"><a href="https://ke.jumia.is/unsafe/fit-in/680x680/filters:fill(white)/product/25/0104492/1.jpg?0566"><img data-src="https://ke.jumia.is/unsafe/fit-in/500x500/filters:fill(white)/product/25/0104492/1.jpg?0566"></a>
<img data-src="https://ke.jumia.is/unsafe/fit-in/80x80/filters:fill(white)/product/25/0104492/2.jpg?0570">
<img data-src="https://ke.jumia.is/unsafe/fit-in/80x80/filters:fill(white)/product/25/0104492/3.jpg?0566">
<img data-src="https://ke.jumia.is/unsafe/fit-in/80x80/filters:fill(white)/product/25/0104492/10.jpg?0566">
<img data-src="https://ke.jumia.is/unsafe/fit-in/80x80/filters:fill(white)/product/25/0104492/4.jpg?0566"></div>
<h1 class="-fs20 -pts -pbxs">Sonar 2L Cordless Electric Kettle, 1500W Energy Efficient, 1.5m Power Cord - Black (1YR WRTY)</h1>
<div class="-pvxs">Brand: <a href="/sonar/">Sonar</a> | <a href="/catalog/?q=sonar">Similar products from Sonar</a></div>
<span class="-b -ubpt -tal -fs24 -prxs" dir="ltr" data-price="">KSh 450</span>
<span class="-tal -gy5 -lthr -fs16 -pvxs -ubpt" data-price-old="">KSh 800</span>
<section><h2 class="hdr -upp -fs14 -m -pas">Key Features</h2><div class="markup -pam"><ul><li>1.5 m extended power cord</li><li>Fast boiling</li><li>2-litre capacity</li></ul></div></section>
<section><h2 class="hdr -upp -fs14 -m -pas">Specifications</h2><ul class="-pvs -mvxs -phm -lsn">
<li class="-pvxs"><span class="-b">SKU</span>: SO460HA3PYR69NAFAMZ</li>
<li class="-pvxs"><span class="-b">Model</span>: P2</li>
<li class="-pvxs"><span class="-b">Size (L x W x H cm)</span>: 19.5 x 17 x 24</li>
<li class="-pvxs"><span class="-b">Weight (kg)</span>: 1</li></ul></section>
<section class="sponsored"><img data-src="https://ke.jumia.is/unsafe/fit-in/300x300/filters:fill(white)/product/77/9999999/1.jpg"></section>
</body></html>`;

describe("importer: link checks", () => {
  test("only Jumia and Kilimall pages are accepted", () => {
    expect(sourceOf("https://www.jumia.co.ke/sonar-kettle-294401052.html?utm_source=x")).toEqual({
      source: "jumia", url: "https://www.jumia.co.ke/sonar-kettle-294401052.html",
    });
    expect(sourceOf("https://www.kilimall.co.ke/listing/123")?.source).toBe("kilimall");
    expect(sourceOf("https://evil.example.com/jumia.co.ke")).toBeNull();
    expect(sourceOf("http://169.254.169.254/latest")).toBeNull();
    expect(sourceOf("file:///etc/passwd")).toBeNull();
  });
  test("only the shops' image servers are allowed", () => {
    expect(isAllowedImageUrl("https://ke.jumia.is/unsafe/fit-in/680x680/x/product/1/2/3.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://image.kilimall.com/kenya/a.jpg")).toBe(true);
    expect(isAllowedImageUrl("https://notjumia.is.evil.com/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("http://localhost:4000/a.jpg")).toBe(false);
  });
  test("warranty is read from names and specs", () => {
    expect(warrantyFrom("Kettle - Black (1YR WRTY)")).toBe(12);
    expect(warrantyFrom("Warranty: 6 months")).toBe(6);
    expect(warrantyFrom("2 years warranty")).toBe(24);
    expect(warrantyFrom("Kettle 2L")).toBeNull();
  });
});

describe("importer: reading pages (needs the database for category lookup)", () => {
  test("Jumia page → full draft", async () => {
    const d = await draftFromHtml(JUMIA_HTML, { source: "jumia" });
    expect(d.name).toBe("Sonar 2L Cordless Electric Kettle, 1500W Energy Efficient, 1.5m Power Cord - Black (1YR WRTY)");
    expect(d.brand).toBe("Sonar");
    expect(d.price).toBe(450);
    expect(d.compareAtPrice).toBe(800);
    expect(d.sku).toBe("SO460HA3PYR69NAFAMZ");
    expect(d.warrantyMonths).toBe(12);
    expect(d.active).toBe(true);
    expect(d.breadcrumb.at(-1)).toBe("Electric Kettles");
    expect(d.category?.id).toBeGreaterThan(0); // Home Appliances
    // All gallery images of THIS product, in order, upgraded to 680×680; sponsored product excluded.
    expect(d.images).toEqual([1, 2, 3, 4, 10].map((n) => `https://ke.jumia.is/unsafe/fit-in/680x680/filters:fill(white)/product/25/0104492/${n}.jpg`));
    // Page specs first, then specs read from the title.
    expect(d.specs.slice(0, 3)).toEqual([
      { label: "Model", value: "P2" },
      { label: "Size (L x W x H cm)", value: "19.5 x 17 x 24" },
      { label: "Weight (kg)", value: "1" },
    ]);
    expect(d.specs).toContainEqual({ label: "Power", value: "1500W" });
    expect(d.specs).toContainEqual({ label: "Capacity", value: "2 L" });
    expect(d.description).toContain("• Fast boiling");
  });

  test("Kilimall page → all photos, displayed price, specs from title, TVs", async () => {
    const IMG = (f, w) => `https://img.kilimall.com/gallery/store/100015131/${f}.jpg?x-image-process=image/resize,w_${w}`;
    const html = `<html><head>
      <meta property="og:title" content="Vitron 32 Inch QLED TV Frameless Smart TV HD Netflix TV HTC3288QS Youtube Television DVB-T2 Android 16 AC Energy Saving Television 1G+8G">
      <meta property="og:image" content="https://img.kilimall.com/gallery/store/100015131/202610/7901995322384d63a5b3aea60029e9de.jpg">
      <meta property="product:price:amount" content="11999">
      <meta property="og:description" content="Buy now at KSh 11999 on Kilimall">
      </head><body>
      <div class="breadcrumb-box"><a href="/">Home</a><a href="/c/1">Electronics &amp; Appliances</a><a href="/c/2">Television &amp; Video</a><a href="/c/3">Televisions</a><a href="/c/4">Smart TVS</a></div>
      <h1 class="title">Vitron 32 Inch QLED TV Frameless Smart TV HD Netflix TV HTC3288QS Youtube Television DVB-T2 Android 16 AC Energy Saving Television 1G+8G</h1>
      <div class="coupon">KSh 100 off · Claim Now</div>
      <div class="price"><span class="sale-price">KSh 11,899</span><span class="del-price">KSh 19,999</span><span>-41%</span></div>
      <img src="${IMG("202610/7901995322384d63a5b3aea60029e9de", 960)}">
      <img src="${IMG("202610/7901995322384d63a5b3aea60029e9de", 240)}">
      <img src="${IMG("202609/f118708b87c743c4b089e662f3b49827", 240)}">
      <img src="${IMG("202609/b4b564312c544afca2b79cc5088679f9", 240)}">
      <img src="${IMG("202609/1fc1a6a94dbd413b8cef9a72442d6b60", 240)}">
      <script>window.__data={"imgs":["https:\\/\\/img.kilimall.com\\/gallery\\/store\\/100015131\\/202609\\/2cd5dfd89d6547c6be267421df6a9f0e.jpg"]}</script>
      <div class="recommend"><img src="https://img.kilimall.com/gallery/store/999/202609/other.jpg?x-image-process=image/resize,w_240"></div>
      </body></html>`;
    const d = await draftFromHtml(html, { source: "kilimall" });
    expect(d.name).toStartWith("Vitron 32 Inch QLED TV");
    expect(d.brand).toBe("Vitron");
    expect(d.price).toBe(11899);
    expect(d.compareAtPrice).toBe(19999);
    expect(d.images).toEqual([
      "202610/7901995322384d63a5b3aea60029e9de", "202609/f118708b87c743c4b089e662f3b49827", "202609/b4b564312c544afca2b79cc5088679f9",
      "202609/1fc1a6a94dbd413b8cef9a72442d6b60", "202609/2cd5dfd89d6547c6be267421df6a9f0e",
    ].map((f) => `https://img.kilimall.com/gallery/store/100015131/${f}.jpg`));
    expect(d.specs).toEqual(expect.arrayContaining([
      { label: "Screen size", value: "32 inch" }, { label: "RAM", value: "1GB" }, { label: "Storage", value: "8GB" },
      { label: "Display", value: "QLED" }, { label: "Resolution", value: "HD" }, { label: "Operating system", value: "Android 16" },
      { label: "Model", value: "HTC3288QS" }, { label: "Tuner", value: "DVB-T2 (free-to-air)" },
    ]));
    expect(d.breadcrumb.at(-1)).toBe("Smart TVS");
    const [tvs] = await (await import("../src/db.js")).sql`SELECT id FROM categories WHERE slug = 'tvs'`;
    expect(d.category?.id).toBe(tvs.id);
    expect(d.description).toBe(""); // the meta description only repeats a stale price
  });

  test("standard product data (JSON-LD) works for other pages", async () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Oraimo FreePods 4","brand":{"name":"Oraimo"},"sku":"OEB-E04","image":["https://image.kilimall.com/kenya/a.jpg","https://image.kilimall.com/kenya/b.jpg"],"offers":{"price":"3499","priceCurrency":"KES"}}</script>`;
    const d = await draftFromHtml(html, { source: "kilimall" });
    expect(d.name).toBe("Oraimo FreePods 4");
    expect(d.brand).toBe("Oraimo");
    expect(d.price).toBe(3499);
    expect(d.images).toHaveLength(2);
  });

  test("pasted page text → draft", async () => {
    const d = await draftFromText(`Sonar 2L Cordless Electric Kettle (1YR WRTY)
Brand: Sonar
KSh 450
KSh 800
- Fast boiling
- 2-litre capacity
Model: P2
Weight (kg): 1`);
    expect(d.name).toContain("Sonar 2L");
    expect(d.brand).toBe("Sonar");
    expect(d.price).toBe(450);
    expect(d.compareAtPrice).toBe(800);
    expect(d.specs).toContainEqual({ label: "Model", value: "P2" });
    expect(d.description).toContain("• Fast boiling");
  });

  test("a page with no product is rejected clearly", async () => {
    await expect(draftFromHtml("<html><body>nothing</body></html>", { source: "jumia" })).rejects.toThrow(/Couldn't find the product/);
  });
});

/* ---------------- API ---------------- */
const BASE = process.env.API_URL || "http://localhost:4000";
const ADMIN = { phone: process.env.TEST_ADMIN_PHONE || "0711111111", password: process.env.TEST_ADMIN_PASSWORD || "admin-pass-1" };
async function api(path, { method = "GET", body, token } = {}) {
  const headers = { "do-connecting-ip": `10.9.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
}

describe("importer: API", () => {
  let admin, staff;
  beforeAll(async () => {
    admin = (await api("/api/auth/login", { method: "POST", body: ADMIN })).data.token;
    const phone = `07${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    await api("/api/admin/users", { method: "POST", token: admin, body: { fullName: "Import Staff", phone, password: "staff-pass", role: "staff" } });
    staff = (await api("/api/auth/login", { method: "POST", body: { phone, password: "staff-pass" } })).data.token;
  });

  test("only admins can import; other sites are refused", async () => {
    expect((await api("/api/admin/import/preview", { method: "POST", body: { url: "https://www.jumia.co.ke/x.html" } })).status).toBe(401);
    expect((await api("/api/admin/import/preview", { method: "POST", token: staff, body: { url: "https://www.jumia.co.ke/x.html" } })).status).toBe(403);
    const r = await api("/api/admin/import/preview", { method: "POST", token: admin, body: { url: "https://example.com/phone" } });
    expect(r.status).toBe(400);
    expect(r.data.error).toContain("jumia.co.ke");
  });

  test("preview from pasted page source keeps all photos", async () => {
    const r = await api("/api/admin/import/preview", { method: "POST", token: admin, body: { url: "https://www.jumia.co.ke/sonar-kettle-294401052.html", text: JUMIA_HTML } });
    expect(r.status).toBe(200);
    expect(r.data.draft.price).toBe(450);
    expect(r.data.draft.images).toHaveLength(5);
    expect(r.data.source).toBe("jumia");
  });

  test("preview from pasted text", async () => {
    const r = await api("/api/admin/import/preview", { method: "POST", token: admin, body: { text: "Test Kettle 2L\nKSh 999\nModel: K1" } });
    expect(r.status).toBe(200);
    expect(r.data.draft.price).toBe(999);
  });

  test("save → product is visible, source remembered, duplicates refused", async () => {
    const url = `https://www.jumia.co.ke/test-kettle-${Date.now()}.html`;
    const body = {
      name: `Imported Kettle ${Date.now()}`, brand: "Sonar", price: 450, compareAtPrice: 800, stock: 7, active: true,
      specs: [{ label: "Model", value: "P2" }], images: [], sourceUrl: url, sourceSku: `SKU${Date.now()}`, sourcePrice: 450, sourceOldPrice: 800,
    };
    const r = await api("/api/admin/import/save", { method: "POST", token: admin, body });
    expect(r.status).toBe(200);
    expect(r.data.product.active).toBe(true);
    expect(r.data.product.price).toBe(450);
    expect((await api(`/api/products/${r.data.product.slug}`)).status).toBe(200); // live in the store

    const detail = await api(`/api/admin/products/${r.data.product.id}`, { token: admin });
    expect(detail.data.product.source).toMatchObject({ site: "jumia", url, price: 450 });

    const again = await api("/api/admin/import/save", { method: "POST", token: admin, body: { ...body, name: "Again" } });
    expect(again.status).toBe(409);
    expect(again.data.error).toContain("Already imported");
  });

  test("images from other hosts are never downloaded", async () => {
    const r = await api("/api/admin/import/save", {
      method: "POST", token: admin,
      body: { name: `No Img ${Date.now()}`, price: 100, stock: 1, images: ["http://169.254.169.254/latest/meta-data"] },
    });
    expect(r.status).toBe(200);
    expect(r.data.product.images).toEqual([]);
    expect(r.data.imageErrors).toHaveLength(1);
  });
});
