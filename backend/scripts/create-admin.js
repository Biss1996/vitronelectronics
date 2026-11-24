// Creates an admin account, or promotes an existing account to admin.
// Usage: bun run create-admin <phone> <password> "<Full Name>"
//   e.g. bun run create-admin 0712345678 'S3cure-pass' "Jane Wanjiku"
import { sql } from "../src/db.js";
import { migrate } from "../src/migrate.js";
import { hashPassword } from "../src/auth.js";
import { normalizePhone } from "../src/validate.js";

const [rawPhone, password, ...nameParts] = process.argv.slice(2);
const fullName = nameParts.join(" ").trim() || "Store Admin";
const phone = normalizePhone(rawPhone);

if (!phone || !password || password.length < 8) {
  console.error('Usage: bun run create-admin <phone> <password (8+ chars)> "<Full Name>"');
  process.exit(1);
}

await migrate();
const hash = await hashPassword(password);
const [user] = await sql`
  INSERT INTO users (full_name, phone, password_hash, role)
  VALUES (${fullName}, ${phone}, ${hash}, 'admin')
  ON CONFLICT (phone) DO UPDATE
    SET role = 'admin', active = TRUE, password_hash = EXCLUDED.password_hash, updated_at = now()
  RETURNING id, full_name, phone, role`;

console.log(`[create-admin] ${user.full_name} (${user.phone}) is now an admin. Sign in at /admin/login`);
await sql.close();
