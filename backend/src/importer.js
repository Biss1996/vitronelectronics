// Product importer: reads a Jumia / Kilimall product page into a draft product.
// Only allow-listed hosts are ever fetched (pages and images), so the importer
// can't be used to reach other addresses.
import { sql } from "./db.js";
import { HttpError, badRequest } from "./http.js";

/* ------------------------------------------------------------------ */
/* Allow-lists                                                         */
/* ------------------------------------------------------------------ */

const PAGE_HOSTS = {
  "jumia.co.ke": "jumia",
  "www.jumia.co.ke": "jumia",
  "kilimall.co.ke": "kilimall",
  "www.kilimall.co.ke": "kilimall",
};

// Image CDNs used by those sites (suffix match).
const IMAGE_HOST_SUFFIXES = ["jumia.is", "jumia.co.ke", "kilimall.com", "kilimall.co.ke", "kilimall.ke"];

export function sourceOf(rawUrl) {
  let u;
  try { u = new URL(String(rawUrl).trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const source = PAGE_HOSTS[u.hostname.toLowerCase()];
  if (!source) return null;
  u.hash = "";
  u.protocol = "https:";
  // Drop tracking parameters so the same product isn't imported twice.
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|gclid|fbclid|ref|spm|sc)/i.test(k)) u.searchParams.delete(k);
  return { source, url: u.toString() };
}

export function isAllowedImageUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const h = u.hostname.toLowerCase();
    return IMAGE_HOST_SUFFIXES.some((s) => h === s || h.endsWith("." + s));
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Rejects after `ms` no matter what the network is doing. */
function deadline(promise, ms, onTimeout) {
  let t;
  return Promise.race([
    promise,
    new Promise((_, reject) => { t = setTimeout(() => { onTimeout?.(); reject(new HttpError(504, "TIMEOUT")); }, ms); }),
  ]).finally(() => clearTimeout(t));
}

async function fetchLimited(url, opts) {
  const total = opts.totalMs ?? 20000;
  const ctrl = new AbortController();
  try {
    return await deadline(fetchHops(url, { ...opts, outer: ctrl.signal }), total, () => ctrl.abort());
  } catch (err) {
    if (err instanceof HttpError && err.message === "TIMEOUT") {
      throw new HttpError(504, "The source site didn't answer our server in time. Use “Paste page” instead.");
    }
    throw err;
  }
}

async function fetchHops(url, { accept, maxBytes, timeoutMs = 12000, allow, outer }) {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    outer?.addEventListener("abort", () => ctrl.abort(), { once: true });
    let res;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": UA, accept, "accept-language": "en-KE,en;q=0.9" },
      });
    } catch (err) {
      clearTimeout(timer);
      throw new HttpError(502, ctrl.signal.aborted ? "The source site took too long to respond" : "Couldn't reach the source site");
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      clearTimeout(timer);
      const next = new URL(res.headers.get("location"), current).toString();
      if (!allow(next)) throw new HttpError(502, "The source site redirected somewhere we don't import from");
      current = next;
      continue;
    }
    try {
      if (res.status === 403 || res.status === 429 || res.status === 503) {
        throw new HttpError(502, "The source site blocked the request. Use “Paste page” instead.");
      }
      if (res.status === 404 || res.status === 410) throw new HttpError(404, "That product page doesn't exist any more");
      if (!res.ok) throw new HttpError(502, `The source site answered ${res.status}`);
      const len = Number(res.headers.get("content-length") || 0);
      if (len > maxBytes) throw new HttpError(502, "The page is too large to import");
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maxBytes) { ctrl.abort(); throw new HttpError(502, "The page is too large to import"); }
        chunks.push(value);
      }
      return { body: Buffer.concat(chunks), type: res.headers.get("content-type") || "", finalUrl: current };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new HttpError(502, "Too many redirects");
}

export async function fetchPage(url) {
  const r = await fetchLimited(url, {
    accept: "text/html,application/xhtml+xml",
    maxBytes: MAX_PAGE_BYTES,
    totalMs: 20000,
    allow: (u) => Boolean(sourceOf(u)),
  });
  return r.body.toString("utf8");
}

export async function fetchImage(url) {
  if (!isAllowedImageUrl(url)) throw badRequest("Image host not allowed");
  const r = await fetchLimited(url, {
    accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5",
    maxBytes: MAX_IMAGE_BYTES,
    timeoutMs: 12000,
    totalMs: 15000,
    allow: isAllowedImageUrl,
  });
  let type = r.type.split(";")[0].trim().toLowerCase();
  if (!type.startsWith("image/")) {
    // Some CDNs send octet-stream; sniff the bytes.
    const b = r.body;
    if (b[0] === 0xff && b[1] === 0xd8) type = "image/jpeg";
    else if (b[0] === 0x89 && b[1] === 0x50) type = "image/png";
    else if (b.slice(8, 12).toString() === "WEBP") type = "image/webp";
    else throw badRequest("Not an image");
  }
  if (type === "image/jpg") type = "image/jpeg";
  const ext = type.split("/")[1].replace("jpeg", "jpg");
  return new File([r.body], `import.${ext}`, { type });
}

/* ------------------------------------------------------------------ */
/* Small HTML helpers (regex based — pages are read, never executed)   */
/* ------------------------------------------------------------------ */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#x27": "'", "#x2F": "/", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", deg: "°", times: "×" };
export function decode(s) {
  return String(s ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9#]+);/gi, (m, k) => ENTITIES[k] ?? ENTITIES[k.toLowerCase()] ?? m);
}
export const textOf = (html) => decode(String(html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[:.]/g, "\\$&")}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] || "").trim() : "";
}

const money = (s) => {
  if (s == null) return null;
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

function jsonLdProducts(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      const stack = Array.isArray(data) ? [...data] : [data];
      while (stack.length) {
        const d = stack.shift();
        if (!d || typeof d !== "object") continue;
        if (Array.isArray(d["@graph"])) stack.push(...d["@graph"]);
        const t = d["@type"];
        if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) out.push(d);
      }
    } catch { /* ignore broken blocks */ }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Draft helpers                                                       */
/* ------------------------------------------------------------------ */

export function warrantyFrom(text) {
  const t = String(text || "");
  let m = t.match(/(\d+)\s*-?\s*(yrs?|years?)\b[^a-z]{0,6}(wrty|warranty|warr)?/i);
  if (m && /(wrty|warranty|warr)/i.test(t)) return Math.min(120, Number(m[1]) * 12);
  m = t.match(/(\d+)\s*-?\s*(months?|mnths?|mths?)\b[^a-z]{0,6}(wrty|warranty|warr)?/i);
  if (m && /(wrty|warranty|warr)/i.test(t)) return Math.min(120, Number(m[1]));
  return null;
}

const CATEGORY_RULES = [
  ["phones", /\b(smart ?phones?|mobile phones?|phones?|iphone|android phone|feature phone)\b/i],
  ["tablets", /\b(tablets?|ipad|tab \w+)\b/i],
  ["laptops", /\b(laptops?|notebooks?|macbook|chromebook|computers?)\b/i],
  ["tvs", /\b(tvs?|televisions?|smart tv|led tv)\b/i],
  ["smartwatches", /\b(smart ?watch(es)?|fitness band|smart band)\b/i],
  ["gaming", /\b(gaming|playstation|ps[45]|xbox|nintendo|console|controller)\b/i],
  ["cameras", /\b(cameras?|camcorders?|dslr|mirrorless|webcam|cctv)\b/i],
  ["audio", /\b(audio|headphones?|earphones?|earbuds?|speakers?|soundbars?|home theat(re|er)|subwoofer|radio)\b/i],
  ["home-appliances", /\b(appliances?|kettles?|blenders?|fridges?|refrigerators?|freezers?|microwaves?|cookers?|ovens?|irons?|fans?|heaters?|washing machines?|air fryers?|toasters?|juicers?|vacuum|dispensers?|kitchen)\b/i],
  ["accessories", /\b(accessor(y|ies)|chargers?|cables?|power ?banks?|cases?|covers?|screen protectors?|adapters?|memory cards?|flash ?disks?|mouse|keyboards?)\b/i],
];

export async function suggestCategory(breadcrumb, name) {
  const crumbs = (breadcrumb || []).slice().reverse().join(" › ");
  const cats = await sql`SELECT id, slug FROM categories WHERE active`;
  const bySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id]));
  for (const text of [crumbs, name]) {
    for (const [slug, re] of CATEGORY_RULES) if (re.test(text || "") && bySlug[slug]) return bySlug[slug];
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Parsers                                                             */
/* ------------------------------------------------------------------ */

function cleanName(n) {
  return decode(n || "").replace(/\s*\|\s*Jumia.*$/i, "").replace(/\s*[-|]\s*Kilimall.*$/i, "").replace(/^Buy\s+/i, "").replace(/\s+/g, " ").trim();
}

/** Gallery image URLs on Jumia: keep only this product's folder, upgraded to 680×680. */
function jumiaImages(html, ogImage) {
  const re = /https?:\/\/[a-z0-9.-]*jumia\.is\/unsafe\/fit-in\/\d+x\d+\/filters:fill\(white\)\/product\/([0-9]+\/[0-9]+\/[0-9]+\.(?:jpe?g|png|webp))/gi;
  const found = [];
  for (const m of html.matchAll(re)) found.push(m[1]);
  if (!found.length) return ogImage ? [ogImage] : [];
  const folder = (p) => p.replace(/\/[^/]+$/, "");
  const ogPath = ogImage?.match(/\/product\/([0-9]+\/[0-9]+\/[0-9]+\.\w+)/i)?.[1];
  const counts = {};
  for (const p of found) counts[folder(p)] = (counts[folder(p)] || 0) + 1;
  const main = ogPath ? folder(ogPath) : Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const files = [...new Set(found.filter((p) => folder(p) === main))]
    .sort((a, b) => Number(a.match(/(\d+)\.\w+$/)[1]) - Number(b.match(/(\d+)\.\w+$/)[1]));
  return files.map((p) => `https://ke.jumia.is/unsafe/fit-in/680x680/filters:fill(white)/product/${p}`);
}

function sectionAfter(html, heading, maxLen = 20000) {
  const i = html.search(new RegExp(`>\\s*${heading}\\s*<`, "i"));
  return i < 0 ? "" : html.slice(i, i + maxLen);
}

function parseJumia(html) {
  const d = {};
  d.name = cleanName(textOf(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || meta(html, "og:title"));
  d.brand = decode(html.match(/Brand\s*:\s*<a[^>]*>([^<]+)<\/a>/i)?.[1] || html.match(/"brand"\s*:\s*"([^"]+)"/)?.[1] || "").trim();
  d.price = money(html.match(/"rawPrice"\s*:\s*"?([\d.]+)/)?.[1])
    ?? money(html.match(/data-price(?:=["'][^"']*["'])?[^>]*>\s*KSh\s*([\d,]+)/i)?.[1]);
  d.compareAtPrice = money(html.match(/"rawOldPrice"\s*:\s*"?([\d.]+)/)?.[1])
    ?? money(html.match(/data-price-old(?:=["'][^"']*["'])?[^>]*>\s*KSh\s*([\d,]+)/i)?.[1]);
  d.breadcrumb = [...html.matchAll(/<a[^>]+class=["'][^"']*\bcbs\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => textOf(m[1])).filter(Boolean);
  d.images = jumiaImages(html, meta(html, "og:image"));

  // Specifications: "<span class="-b">Label</span>: value" items.
  const specHtml = sectionAfter(html, "Specifications");
  d.specs = [];
  for (const m of specHtml.matchAll(/<li[^>]*>\s*<span[^>]*>([^<]{1,60})<\/span>\s*:?\s*([\s\S]*?)<\/li>/gi)) {
    const label = textOf(m[1]).replace(/:$/, "");
    const value = textOf(m[2]).replace(/^:\s*/, "");
    if (label && value && value.length < 300) d.specs.push({ label, value });
  }
  d.sku = d.specs.find((s) => /^sku$/i.test(s.label))?.value || html.match(/"sku"\s*:\s*"([^"]+)"/)?.[1] || null;
  d.specs = d.specs.filter((s) => !/^sku$/i.test(s.label));

  // Key features → description bullets.
  const kf = sectionAfter(html, "Key Features", 8000).match(/<ul[^>]*>([\s\S]*?)<\/ul>/i)?.[1] || "";
  const features = [...kf.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => textOf(m[1])).filter(Boolean);
  d.description = features.length ? features.map((f) => `• ${f}`).join("\n") : meta(html, "og:description");
  return d;
}

/** Undo JSON escaping so image URLs inside embedded data can be matched too. */
const unescapeUrls = (html) => html.replace(/\\u002F/gi, "/").replace(/\\\//g, "/");

/** Most product titles carry the key specs ("32 Inch QLED … Android 16 1G+8G"). */
export function specsFromTitle(name) {
  const t = String(name || "");
  const out = [];
  const add = (label, value) => value && out.push({ label, value });
  let m;
  if ((m = t.match(/(\d{2,3}(?:\.\d)?)\s*-?\s*(?:inch(?:es)?|"|”)/i))) add("Screen size", `${m[1]} inch`);
  if ((m = t.match(/\b(\d{1,2})\s*G(?:B)?\s*\+\s*(\d{1,4})\s*G(?:B)?\b/i))) { add("RAM", `${m[1]}GB`); add("Storage", `${m[2]}GB`); }
  else {
    if ((m = t.match(/\b(\d{1,2})\s*GB\s*RAM\b/i))) add("RAM", `${m[1]}GB`);
    if ((m = t.match(/\b(\d{2,4})\s*GB\s*(?:ROM|storage|SSD|HDD)?\b/i))) add("Storage", `${m[1]}GB`);
  }
  if ((m = t.match(/\b(QLED|OLED|AMOLED|Super AMOLED|LED|LCD|IPS)\b/i))) add("Display", m[1].toUpperCase().replace("SUPER AMOLED", "Super AMOLED"));
  if ((m = t.match(/\b(8K|4K|UHD|Full HD|FHD|HD)\b/i))) add("Resolution", m[1].replace(/^full hd$/i, "Full HD").toUpperCase().replace("FULL HD", "Full HD"));
  if ((m = t.match(/\b(Android(?:\s*TV)?\s*\d{1,2}|Android TV|Google TV|webOS|Tizen|VIDAA|iOS\s*\d{1,2}|Windows\s*1[01])\b/i))) add("Operating system", m[1]);
  if (/\bDVB-?T2\b/i.test(t)) add("Tuner", "DVB-T2 (free-to-air)");
  if ((m = t.match(/\b(\d{3,5})\s*mAh\b/i))) add("Battery", `${m[1]}mAh`);
  if ((m = t.match(/\b(\d{2,4})\s*W\b/))) add("Power", `${m[1]}W`);
  if ((m = t.match(/\b(\d+(?:\.\d+)?)\s*(?:L|Litres?|Liters?)\b/))) add("Capacity", `${m[1]} L`);
  // Model: the longest code with both letters and digits, e.g. HTC3288QS (not DVB-T2 or 1G+8G).
  const codes = (t.match(/\b[A-Z0-9][A-Z0-9-]{5,}\b/g) || [])
    .filter((c) => /\d/.test(c) && /[A-Z]/.test(c) && !/^DVB/i.test(c) && !/^\d+(GB|G|MAH|W|L)$/i.test(c));
  if (codes.length) add("Model", codes.sort((a, b) => b.length - a.length)[0]);
  return out;
}

function parseKilimall(rawHtml) {
  const html = unescapeUrls(rawHtml);
  const d = { specs: [] };
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  d.name = cleanName(textOf(h1?.[1]) || meta(html, "og:title"));

  // Photos: every image of this product's store folder, in page order, without resize parameters.
  const og = meta(html, "og:image");
  const folder = og.match(/img\.kilimall\.com\/(gallery\/store\/\d+)\//i)?.[1];
  const seen = new Set();
  d.images = [];
  for (const m of html.matchAll(/https?:\/\/img\.kilimall\.com\/[^"'\s)<>?]+?\.(?:jpe?g|png|webp)/gi)) {
    const url = m[0].replace(/^http:/, "https:");
    if (folder && !url.includes(`/${folder}/`)) continue;   // skip other shops' / recommended items
    if (!folder && !/\/gallery\//.test(url)) continue;
    if (!seen.has(url)) { seen.add(url); d.images.push(url); }
  }
  if (og && !seen.has(og.split("?")[0])) d.images.unshift(og.split("?")[0]);

  // Price: the displayed price near the title (the meta price can be stale), and the crossed-out one.
  const metaPrice = money(meta(html, "product:price:amount") || meta(html, "og:price:amount"));
  const after = h1 ? html.slice(h1.index, h1.index + 60000) : html;
  const shown = [...after.matchAll(/KSh\s*([\d,]{2,})/gi)].map((m) => money(m[1])).filter(Boolean);
  const isPrice = (v) => (metaPrice ? v >= metaPrice * 0.75 && v <= metaPrice * 1.25 : v >= 200);
  const pi = shown.findIndex(isPrice);
  d.price = pi >= 0 ? shown[pi] : metaPrice;
  d.compareAtPrice = pi >= 0 ? shown.slice(pi + 1, pi + 6).find((v) => v > d.price * 1.03 && v < d.price * 5) ?? null : null;

  d.brand = decode(html.match(/<a[^>]+href=["'][^"']*\/brand[^"']*["'][^>]*>\s*([^<]{2,40}?)\s*<\/a>/i)?.[1] || "").trim();
  const crumbBlock = html.match(/class=["'][^"']*breadcrumb[^"']*["'][\s\S]{0,6000}/i)?.[0] || "";
  d.breadcrumb = [...crumbBlock.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => textOf(m[1])).filter((t) => t && t.length < 60).slice(0, 8);
  const desc = meta(html, "og:description");
  d.description = /KSh/i.test(desc) ? "" : desc;
  return d;
}

function parseGeneric(html) {
  const d = { specs: [], breadcrumb: [] };
  const ld = jsonLdProducts(html)[0];
  if (ld) {
    d.name = cleanName(ld.name);
    d.brand = typeof ld.brand === "string" ? ld.brand : ld.brand?.name || "";
    d.sku = ld.sku || ld.mpn || null;
    d.description = textOf(ld.description || "");
    const imgs = Array.isArray(ld.image) ? ld.image : ld.image ? [ld.image] : [];
    d.images = imgs.map((i) => (typeof i === "string" ? i : i?.url)).filter(Boolean);
    const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
    d.price = money(offer?.price ?? offer?.lowPrice);
    for (const p of ld.additionalProperty || []) if (p?.name && p?.value) d.specs.push({ label: String(p.name), value: String(p.value) });
  }
  d.name ||= cleanName(meta(html, "og:title") || textOf(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) || textOf(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]));
  d.price ??= money(meta(html, "product:price:amount") || meta(html, "og:price:amount"));
  d.description ||= meta(html, "og:description") || meta(html, "description");
  if (!d.images?.length) {
    const og = meta(html, "og:image");
    d.images = og ? [og] : [];
  }
  return d;
}

/** Read a fetched page into a draft (product-shaped, like GET /api/admin/products/:id). */
export async function draftFromHtml(html, { source }) {
  const base = parseGeneric(html);
  const site = source === "jumia" ? parseJumia(html) : source === "kilimall" ? parseKilimall(html) : {};
  const d = {
    name: site.name || base.name || "",
    brand: site.brand || base.brand || "",
    sku: site.sku || base.sku || null,
    description: (site.description !== undefined ? site.description : base.description) || "",
    price: site.price ?? base.price ?? null,
    compareAtPrice: site.compareAtPrice ?? base.compareAtPrice ?? null,
    specs: (site.specs?.length ? site.specs : base.specs || []).slice(0, 60),
    images: [...new Set(site.images?.length ? site.images : base.images || [])].filter(isAllowedImageUrl).slice(0, 12),
    breadcrumb: site.breadcrumb?.length ? site.breadcrumb : base.breadcrumb || [],
  };
  return finishDraft(d);
}

/** Fallback when a site blocks us: parse text the admin copied from the page. */
export async function draftFromText(text) {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw badRequest("Paste the product page text first");
  const prices = [...text.matchAll(/KSh\s*([\d,]+)/gi)].map((m) => money(m[1])).filter(Boolean);
  const specs = [];
  const features = [];
  for (const l of lines.slice(1)) {
    const kv = l.match(/^([A-Za-z][\w ()/.-]{1,40})\s*:\s*(.{1,200})$/);
    if (kv && !/^(brand|sku|price)$/i.test(kv[1].trim())) specs.push({ label: kv[1].trim(), value: kv[2].trim() });
    else if (/^[•*\-–]\s+/.test(l)) features.push(l.replace(/^[•*\-–]\s+/, ""));
  }
  const d = {
    name: cleanName(lines[0]),
    brand: text.match(/Brand\s*:\s*([^\n|]+)/i)?.[1]?.trim() || "",
    sku: text.match(/SKU\s*:\s*(\S+)/i)?.[1] || null,
    description: features.map((f) => `• ${f}`).join("\n"),
    price: prices[0] ?? null,
    compareAtPrice: prices[1] && prices[1] > prices[0] ? prices[1] : null,
    specs: specs.slice(0, 60),
    images: [],
    breadcrumb: [],
  };
  return finishDraft(d);
}

async function finishDraft(d) {
  if (!d.name) throw new HttpError(422, "Couldn't find the product on that page. Use “Paste page” instead.");
  // Fill in specs the title states but the page doesn't list.
  const have = new Set(d.specs.map((s) => s.label.toLowerCase()));
  for (const s of specsFromTitle(d.name)) if (!have.has(s.label.toLowerCase())) d.specs.push(s);
  // Brand: many titles start with it ("Vitron 32 Inch …").
  if (!d.brand) {
    const first = d.name.split(/\s+/)[0] || "";
    if (/^[A-Za-z][A-Za-z&.-]{1,20}$/.test(first) && !/^(new|original|genuine|smart|the|best|brand)$/i.test(first)) {
      d.brand = /^[A-Z&]{2,4}$/.test(first) ? first : first[0].toUpperCase() + first.slice(1).toLowerCase();
    }
  }
  const warranty = warrantyFrom(`${d.name}\n${d.specs.map((s) => `${s.label}: ${s.value}`).join("\n")}`);
  const categoryId = await suggestCategory(d.breadcrumb, d.name);
  return {
    name: d.name.slice(0, 160),
    brand: (d.brand || "").slice(0, 60),
    sku: d.sku ? String(d.sku).slice(0, 60) : "",
    category: categoryId ? { id: categoryId } : null,
    condition: /\b(ex[- ]?uk)\b/i.test(d.name) ? "ex_uk" : /\b(refurb(ished)?)\b/i.test(d.name) ? "refurbished" : "new",
    warrantyMonths: warranty ?? 12,
    price: d.price ?? 0,
    compareAtPrice: d.compareAtPrice && d.price && d.compareAtPrice > d.price ? d.compareAtPrice : null,
    stock: null,
    description: (d.description || "").slice(0, 5000),
    images: d.images,
    specs: d.specs.map((s) => ({ label: s.label.slice(0, 60), value: s.value.slice(0, 300) })),
    variants: [],
    featured: false,
    isNew: true,
    active: true, // imported products go live straight away
    breadcrumb: d.breadcrumb,
  };
}

/** Find a product already imported from this URL or with this source SKU. */
export async function findExisting(url, source, sku) {
  const [row] = await sql`
    SELECT ps.product_id AS id, p.name FROM product_sources ps JOIN products p ON p.id = ps.product_id
    WHERE ps.url = ${url} ${sku ? sql`OR (ps.source = ${source} AND ps.external_id = ${sku})` : sql``}
    LIMIT 1`;
  return row || null;
}
