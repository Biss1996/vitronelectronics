// Fills an empty database with sample categories and products.
// Usage: bun run seed          (skips if products already exist)
//        bun run seed --force  (adds the sample products even if some exist)
import { sql, json } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { slugify } from "../src/validate.js";
import { CATEGORIES, PRODUCTS } from "./seed-data.js";

await migrate();

const force = process.argv.includes("--force");
const [{ n }] = await sql`SELECT count(*)::int AS n FROM products`;
if (n > 0 && !force) {
  console.log(`[seed] ${n} products already exist — nothing to do (use --force to add samples anyway).`);
  await sql.close();
  process.exit(0);
}

await sql.begin(async (tx) => {
  const catIds = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const [row] = await tx`
      INSERT INTO categories (name, slug, image_url, sort_order) VALUES (${c.name}, ${c.slug}, ${c.image}, ${i})
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id`;
    catIds[c.slug] = row.id;
  }

  for (const p of PRODUCTS) {
    let slug = slugify(p.name);
    const [taken] = await tx`SELECT 1 FROM products WHERE slug = ${slug}`;
    if (taken) slug = `${slug}-${Date.now().toString(36)}`;
    const variants = p.variants || [];
    const price = variants.length ? Math.min(...variants.map((v) => v.price)) : p.price;
    const [row] = await tx`
      INSERT INTO products (name, slug, brand, category_id, description, price, compare_at_price, stock, condition,
                            warranty_months, specs, images, featured, is_new)
      VALUES (${p.name}, ${slug}, ${p.brand}, ${catIds[p.category]}, ${p.description}, ${price}, ${p.compareAtPrice ?? null},
              ${variants.length ? 0 : p.stock ?? 0}, ${p.condition}, ${p.warrantyMonths ?? 0}, ${json(p.specs)}::text::jsonb,
              ${json(p.images)}::text::jsonb, ${!!p.featured}, ${!!p.isNew})
      RETURNING id`;
    for (const [i, v] of variants.entries()) {
      await tx`INSERT INTO product_variants (product_id, label, price, stock, sort_order)
               VALUES (${row.id}, ${v.label}, ${v.price}, ${v.stock}, ${i})`;
    }
  }
});

console.log(`[seed] added ${CATEGORIES.length} categories and ${PRODUCTS.length} products.`);
await sql.close();
