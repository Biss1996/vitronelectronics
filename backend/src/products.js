import { sql, json } from "./db.js";
import { badRequest, conflict, notFound } from "./http.js";
import { fields, slugify } from "./validate.js";

// Shared SELECT for a product with its category and variants.
export const productSelect = sql`
  SELECT p.*,
         c.name AS category_name, c.slug AS category_slug,
         COALESCE((
           SELECT json_agg(json_build_object(
                    'id', v.id, 'label', v.label, 'price', v.price, 'stock', v.stock, 'sku', v.sku)
                  ORDER BY v.sort_order, v.id)
           FROM product_variants v WHERE v.product_id = p.id
         ), '[]'::json) AS variants
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id`;

const parseJson = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return fallback; } }
  return v;
};

export function serializeProduct(p) {
  const variants = parseJson(p.variants, []);
  const hasVariants = variants.length > 0;
  const stock = hasVariants ? variants.reduce((s, v) => s + v.stock, 0) : p.stock;
  const fromPrice = hasVariants ? Math.min(...variants.map((v) => v.price)) : p.price;
  const compare = p.compare_at_price && p.compare_at_price > fromPrice ? p.compare_at_price : null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    category: p.category_id ? { id: p.category_id, name: p.category_name, slug: p.category_slug } : null,
    sku: p.sku,
    description: p.description,
    price: fromPrice,
    compareAtPrice: compare,
    discountPercent: compare ? Math.round((1 - fromPrice / compare) * 100) : 0,
    stock,
    inStock: stock > 0,
    condition: p.condition,
    warrantyMonths: p.warranty_months,
    specs: parseJson(p.specs, []),
    images: parseJson(p.images, []),
    featured: p.featured,
    isNew: p.is_new,
    active: p.active,
    variants,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

const SORTS = {
  newest: sql`p.created_at DESC, p.id DESC`,
  price_asc: sql`p.price ASC, p.id`,
  price_desc: sql`p.price DESC, p.id`,
  name: sql`p.name ASC`,
  featured: sql`p.featured DESC, p.created_at DESC, p.id DESC`,
  discount: sql`(p.compare_at_price - p.price)::float / NULLIF(p.compare_at_price, 0) DESC NULLS LAST, p.id DESC`,
};

/** Product search used by both the storefront and the admin list. */
export async function listProducts(params, { includeInactive = false } = {}) {
  const q = (params.get("q") || "").trim().slice(0, 100);
  const category = params.get("category") || "";
  const brand = params.get("brand") || "";
  const condition = params.get("condition") || "";
  const min = Number(params.get("min")) || 0;
  const max = Number(params.get("max")) || 0;
  const featured = params.get("featured") === "true";
  const isNew = params.get("new") === "true";
  const onSale = params.get("sale") === "true";
  const inStock = params.get("inStock") === "true";
  const status = params.get("status") || ""; // admin: active | draft | low
  const ids = (params.get("ids") || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
  const sort = SORTS[params.get("sort")] || SORTS.featured;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 24, 1), 100);
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const offset = (page - 1) * limit;
  const like = `%${q.replace(/[%_\\]/g, (m) => "\\" + m)}%`;

  const where = sql`
    WHERE TRUE
    ${includeInactive ? sql`` : sql`AND p.active`}
    ${status === "active" ? sql`AND p.active` : sql``}
    ${status === "draft" ? sql`AND NOT p.active` : sql``}
    ${status === "low" ? sql`AND p.stock + COALESCE((SELECT SUM(stock) FROM product_variants v WHERE v.product_id = p.id), 0) <= 3` : sql``}
    ${ids.length ? sql`AND p.id IN ${sql(ids)}` : sql``}
    ${q ? sql`AND (p.name ILIKE ${like} OR p.brand ILIKE ${like} OR p.sku ILIKE ${like})` : sql``}
    ${category ? sql`AND c.slug = ${category}` : sql``}
    ${brand ? sql`AND lower(p.brand) = ${brand.toLowerCase()}` : sql``}
    ${condition ? sql`AND p.condition = ${condition}` : sql``}
    ${min > 0 ? sql`AND p.price >= ${min}` : sql``}
    ${max > 0 ? sql`AND p.price <= ${max}` : sql``}
    ${featured ? sql`AND p.featured` : sql``}
    ${isNew ? sql`AND p.is_new` : sql``}
    ${onSale ? sql`AND p.compare_at_price > p.price` : sql``}
    ${inStock ? sql`AND (p.stock > 0 OR EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.stock > 0))` : sql``}`;

  const [rows, [{ total }]] = await Promise.all([
    sql`${productSelect} ${where} ORDER BY ${sort} LIMIT ${limit} OFFSET ${offset}`,
    sql`SELECT count(*)::int AS total FROM products p LEFT JOIN categories c ON c.id = p.category_id ${where}`,
  ]);

  return { items: rows.map(serializeProduct), total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

export async function getProductBy({ id, slug }, { includeInactive = false } = {}) {
  const [row] = id
    ? await sql`${productSelect} WHERE p.id = ${id} ${includeInactive ? sql`` : sql`AND p.active`}`
    : await sql`${productSelect} WHERE p.slug = ${slug} ${includeInactive ? sql`` : sql`AND p.active`}`;
  return row ? serializeProduct(row) : null;
}

/* ---------------- Admin create / update ---------------- */

function readProduct(body) {
  const v = fields(body);
  const data = {
    name: v.str("name", { label: "Product name", min: 2, max: 160 }),
    brand: v.str("brand", { label: "Brand", required: false, max: 60 }),
    sku: v.str("sku", { label: "SKU", required: false, max: 60 }),
    description: v.str("description", { label: "Description", required: false, max: 5000 }) || "",
    price: v.int("price", { label: "Price", min: 0, max: 50_000_000 }),
    compare_at_price: v.int("compareAtPrice", { label: "Compare-at price", required: false, min: 0, max: 50_000_000 }),
    stock: v.int("stock", { label: "Stock", required: false, min: 0, max: 1_000_000 }) ?? 0,
    condition: v.oneOf("condition", ["new", "refurbished", "ex_uk"], { label: "Condition", required: false, fallback: "new" }),
    warranty_months: v.int("warrantyMonths", { label: "Warranty", required: false, min: 0, max: 120 }) ?? 0,
    featured: v.bool("featured"),
    is_new: v.bool("isNew"),
    active: v.bool("active", true),
    category_id: v.int("categoryId", { label: "Category", required: false, min: 1, max: 2_000_000_000 }),
  };

  const slugIn = v.str("slug", { required: false, max: 90 });
  data.slug = slugify(slugIn || data.name || "");

  // Specs: [{label, value}]
  const specs = Array.isArray(body.specs) ? body.specs : [];
  if (specs.length > 60) v.fail("specs", "Too many specs (max 60)");
  data.specs = specs
    .map((s) => ({ label: String(s?.label || "").trim().slice(0, 60), value: String(s?.value || "").trim().slice(0, 300) }))
    .filter((s) => s.label && s.value);

  // Images: ["https://..." or "/api/uploads/..."]
  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length > 20) v.fail("images", "Maximum 20 images per product");
  data.images = images.map((u) => String(u || "").trim()).filter((u) => /^(https?:\/\/|\/api\/uploads\/)/.test(u)).slice(0, 20);

  // Variants: [{id?, label, price, stock, sku}]
  const variants = Array.isArray(body.variants) ? body.variants : [];
  if (variants.length > 50) v.fail("variants", "Maximum 50 variants");
  const labels = new Set();
  data.variants = variants.map((x, i) => {
    const label = String(x?.label || "").trim().slice(0, 80);
    const price = Number(x?.price);
    const stock = Number(x?.stock ?? 0);
    if (!label) v.fail("variants", `Variant ${i + 1} needs a label`);
    else if (labels.has(label.toLowerCase())) v.fail("variants", `Duplicate variant "${label}"`);
    labels.add(label.toLowerCase());
    if (!Number.isInteger(price) || price < 0) v.fail("variants", `Variant "${label}" needs a valid price`);
    if (!Number.isInteger(stock) || stock < 0) v.fail("variants", `Variant "${label}" needs a valid stock`);
    return { id: Number(x?.id) || null, label, price, stock, sku: String(x?.sku || "").trim().slice(0, 60) || null, sort_order: i };
  });

  v.done();
  // With variants, the product's own price/stock mirror the cheapest variant / 0.
  if (data.variants.length) {
    data.price = Math.min(...data.variants.map((x) => x.price));
    data.stock = 0;
  }
  return data;
}

async function uniqueSlug(tx, base, exceptId = 0) {
  let slug = base;
  for (let i = 2; i < 200; i++) {
    const [hit] = await tx`SELECT 1 FROM products WHERE slug = ${slug} AND id <> ${exceptId}`;
    if (!hit) return slug;
    slug = `${base}-${i}`;
  }
  throw conflict("Could not create a unique product URL — change the name");
}

async function assertCategory(tx, id) {
  if (!id) return;
  const [c] = await tx`SELECT 1 FROM categories WHERE id = ${id}`;
  if (!c) throw badRequest("Category does not exist");
}

async function saveVariants(tx, productId, variants) {
  const keepIds = variants.filter((v) => v.id).map((v) => v.id);
  if (keepIds.length) {
    await tx`DELETE FROM product_variants WHERE product_id = ${productId} AND id NOT IN ${tx(keepIds)}`;
  } else {
    await tx`DELETE FROM product_variants WHERE product_id = ${productId}`;
  }
  for (const v of variants) {
    if (v.id) {
      const res = await tx`
        UPDATE product_variants SET label = ${v.label}, price = ${v.price}, stock = ${v.stock}, sku = ${v.sku}, sort_order = ${v.sort_order}
        WHERE id = ${v.id} AND product_id = ${productId} RETURNING id`;
      if (res.length) continue;
    }
    await tx`
      INSERT INTO product_variants (product_id, label, price, stock, sku, sort_order)
      VALUES (${productId}, ${v.label}, ${v.price}, ${v.stock}, ${v.sku}, ${v.sort_order})`;
  }
}

export async function createProduct(body) {
  const d = readProduct(body);
  const id = await sql.begin(async (tx) => {
    await assertCategory(tx, d.category_id);
    const slug = await uniqueSlug(tx, d.slug);
    const [row] = await tx`
      INSERT INTO products (name, slug, brand, category_id, sku, description, price, compare_at_price, stock,
                            condition, warranty_months, specs, images, featured, is_new, active)
      VALUES (${d.name}, ${slug}, ${d.brand}, ${d.category_id}, ${d.sku}, ${d.description}, ${d.price},
              ${d.compare_at_price}, ${d.stock}, ${d.condition}, ${d.warranty_months}, ${json(d.specs)}::text::jsonb,
              ${json(d.images)}::text::jsonb, ${d.featured}, ${d.is_new}, ${d.active})
      RETURNING id`;
    await saveVariants(tx, row.id, d.variants);
    return row.id;
  });
  return getProductBy({ id }, { includeInactive: true });
}

export async function updateProduct(id, body) {
  const d = readProduct(body);
  await sql.begin(async (tx) => {
    const [exists] = await tx`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
    if (!exists) throw notFound("Product not found");
    await assertCategory(tx, d.category_id);
    const slug = await uniqueSlug(tx, d.slug, id);
    await tx`
      UPDATE products SET
        name = ${d.name}, slug = ${slug}, brand = ${d.brand}, category_id = ${d.category_id}, sku = ${d.sku},
        description = ${d.description}, price = ${d.price}, compare_at_price = ${d.compare_at_price},
        stock = ${d.stock}, condition = ${d.condition}, warranty_months = ${d.warranty_months},
        specs = ${json(d.specs)}::text::jsonb, images = ${json(d.images)}::text::jsonb, featured = ${d.featured},
        is_new = ${d.is_new}, active = ${d.active}, updated_at = now()
      WHERE id = ${id}`;
    await saveVariants(tx, id, d.variants);
  });
  return getProductBy({ id }, { includeInactive: true });
}

/** Staff + admin: set stock levels only. body: { stock } or { variants: [{id, stock}] } */
export async function updateStock(id, body) {
  await sql.begin(async (tx) => {
    const [p] = await tx`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
    if (!p) throw notFound("Product not found");
    if (Array.isArray(body.variants)) {
      for (const v of body.variants) {
        const stock = Number(v?.stock);
        if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) throw badRequest("Stock must be a whole number, 0 or more");
        const res = await tx`UPDATE product_variants SET stock = ${stock} WHERE id = ${Number(v.id)} AND product_id = ${id} RETURNING id`;
        if (!res.length) throw badRequest("Variant does not belong to this product");
      }
    } else {
      const stock = Number(body.stock);
      if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) throw badRequest("Stock must be a whole number, 0 or more");
      await tx`UPDATE products SET stock = ${stock}, updated_at = now() WHERE id = ${id}`;
    }
    await tx`UPDATE products SET updated_at = now() WHERE id = ${id}`;
  });
  return getProductBy({ id }, { includeInactive: true });
}
